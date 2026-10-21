import { type Database, getDatabase, isPostgresErrorCode } from "@allinvites/database";
import { err, ok, type Result } from "@allinvites/kernel";
import type {
  CreateInitialSubscriptionService,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@allinvites/module-billing";
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
  readonly subscription: {
    readonly id: string;
    readonly plan: SubscriptionPlan;
    readonly status: SubscriptionStatus;
    readonly trialEndsAt: Date | null;
    readonly createdAt: Date;
  };
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
 *
 * STORY-004-001 — the same transaction also creates the Organization's
 * initial Subscription (always `TRIAL`, no payment check), via Billing's
 * public CreateInitialSubscriptionService (ADR-011: Organizations never
 * touches Subscription domain internals or the `subscriptions` table
 * directly). A failure in either cross-module call rolls back the whole
 * transaction — no Organization is ever observed without both its OWNER
 * membership and its Subscription.
 */
export class CreateOrganizationUseCase {
  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly createInitialOwnerMembership: CreateInitialOwnerMembershipService,
    private readonly createInitialSubscription: CreateInitialSubscriptionService,
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
    let crossModuleFailureCause: unknown;

    try {
      await this.db.transaction(async (tx) => {
        await this.organizationRepository.create(organization, tx);

        const membershipResult = await this.createInitialOwnerMembership(
          { userId: caller.value.userId, organizationId: organization.id },
          tx,
        );

        if (!membershipResult.ok) {
          crossModuleFailureCause =
            membershipResult.error.type === "USER_NOT_FOUND"
              ? new Error("Authenticated caller has no matching User profile.")
              : membershipResult.error.cause;
          throw new Error("CREATE_INITIAL_OWNER_MEMBERSHIP_FAILED");
        }

        const subscriptionResult = await this.createInitialSubscription(
          { organizationId: organization.id, plan: command.plan, userId: caller.value.userId },
          tx,
        );

        if (!subscriptionResult.ok) {
          crossModuleFailureCause = subscriptionResult.error.cause;
          throw new Error("CREATE_INITIAL_SUBSCRIPTION_FAILED");
        }

        result = {
          organization,
          membershipId: membershipResult.value.membershipId,
          subscription: {
            id: subscriptionResult.value.subscriptionId,
            plan: subscriptionResult.value.plan,
            status: subscriptionResult.value.status,
            trialEndsAt: subscriptionResult.value.trialEndsAt,
            createdAt: subscriptionResult.value.createdAt,
          },
        };
      });
    } catch (error) {
      if (crossModuleFailureCause !== undefined) {
        return err({ type: "UNEXPECTED", cause: crossModuleFailureCause });
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
