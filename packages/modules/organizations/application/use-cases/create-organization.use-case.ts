import { type Database, getDatabase, isPostgresErrorCode } from "@allinvites/database";
import { err, ok, type Result } from "@allinvites/kernel";
import type { CreateInitialOwnerMembershipService } from "@allinvites/module-identity";
import { Organization } from "../../domain/entities/organization";
import { InvalidSlugError } from "../../domain/exceptions/invalid-slug.error";
import { OrganizationSlugAlreadyExistsError } from "../../domain/exceptions/organization-slug-already-exists.error";
import type { OrganizationRepository } from "../../domain/repositories/organization-repository";
import { Slug } from "../../domain/value-objects/slug";
import type { CreateOrganizationCommand } from "../commands/create-organization.command";
import type { SessionVerifier } from "../ports/session-verifier";

export type CreateOrganizationError =
  | { readonly type: "UNAUTHORIZED" }
  | InvalidSlugError
  | OrganizationSlugAlreadyExistsError
  | { readonly type: "UNEXPECTED"; readonly cause: unknown };

export type CreateOrganizationResult = {
  readonly organization: Organization;
  readonly membershipId: string;
};

const SLUG_UNIQUE_VIOLATION = "23505";

/**
 * STORY-003-001 — Organization Creation & Onboarding
 * (EPIC_003_ORGANIZATIONS.md §5). Creates a PARTNER Organization and the
 * caller's initial OWNER OrganizationMembership atomically in one database
 * transaction, via Identity's public CreateInitialOwnerMembershipService
 * (ADR-011: Organizations never touches OrganizationMembership internals or
 * the organization_memberships table directly). No event bus, outbox, or
 * asynchronous consumer — the transaction mechanism is the existing shared
 * `@allinvites/database` primitive, opened here and passed through to the
 * Identity contract.
 */
export class CreateOrganizationUseCase {
  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly createInitialOwnerMembership: CreateInitialOwnerMembershipService,
    private readonly sessionVerifier: SessionVerifier,
    private readonly db: Database = getDatabase(),
  ) {}

  async execute(
    accessToken: string,
    command: CreateOrganizationCommand,
  ): Promise<Result<CreateOrganizationResult, CreateOrganizationError>> {
    const caller = await this.sessionVerifier.verify(accessToken);
    if (!caller.ok) {
      if (caller.error.type === "UNAUTHORIZED") {
        return err({ type: "UNAUTHORIZED" });
      }
      return err({ type: "UNEXPECTED", cause: caller.error.cause });
    }

    let slug: Slug;
    try {
      slug = Slug.create(command.slug ?? command.displayName);
    } catch (error) {
      if (error instanceof InvalidSlugError) {
        return err(error);
      }
      throw error;
    }

    const organization = Organization.create({
      id: crypto.randomUUID(),
      displayName: command.displayName,
      slug,
    });

    let result: CreateOrganizationResult | undefined;
    let membershipFailureCause: unknown;

    try {
      await this.db.transaction(async (tx) => {
        await this.organizationRepository.create(organization, tx);

        const membershipResult = await this.createInitialOwnerMembership(
          { userId: caller.value.userId, organizationId: organization.id },
          tx,
        );

        if (!membershipResult.ok) {
          membershipFailureCause =
            membershipResult.error.type === "USER_NOT_FOUND"
              ? new Error("Authenticated caller has no matching User profile.")
              : membershipResult.error.cause;
          throw new Error("CREATE_INITIAL_OWNER_MEMBERSHIP_FAILED");
        }

        result = { organization, membershipId: membershipResult.value.membershipId };
      });
    } catch (error) {
      if (membershipFailureCause !== undefined) {
        return err({ type: "UNEXPECTED", cause: membershipFailureCause });
      }
      if (isPostgresErrorCode(error, SLUG_UNIQUE_VIOLATION)) {
        return err(new OrganizationSlugAlreadyExistsError());
      }
      return err({ type: "UNEXPECTED", cause: error });
    }

    if (!result) {
      return err({
        type: "UNEXPECTED",
        cause: new Error("Transaction committed without a result."),
      });
    }

    return ok(result);
  }
}
