import { err, ok, type Result } from "@allinvites/kernel";
import type { VerifyOwnerMembershipService } from "@allinvites/module-identity";
import type { Organization } from "../../domain/entities/organization";
import type { OrganizationRepository } from "../../domain/repositories/organization-repository";
import type { UpdateOrganizationCommand } from "../commands/update-organization.command";
import type { SessionVerifier } from "../ports/session-verifier";

export type UpdateOrganizationError =
  | { readonly type: "UNAUTHORIZED" }
  | { readonly type: "NOT_FOUND" }
  | { readonly type: "FORBIDDEN" }
  | { readonly type: "ORGANIZATION_SUSPENDED" }
  | { readonly type: "UNEXPECTED"; readonly cause: unknown };

export type UpdateOrganizationResult = {
  readonly organization: Organization;
};

/**
 * STORY-003-003 — Update Organization (EPIC_003_ORGANIZATIONS.md §5).
 * Authorization is delegated to Identity's `verifyOwnerMembership` (ADR-011:
 * Organizations never touches OrganizationMembership internals or the
 * organization_memberships table directly). `NOT_ACTIVE_MEMBER` (no
 * membership, or a non-ACTIVE one) collapses to this use case's `NOT_FOUND`;
 * `NOT_OWNER` (an ACTIVE membership that isn't OWNER) maps to `FORBIDDEN` —
 * a caller who is already a confirmed ACTIVE member learns nothing new from
 * that distinction. A SYSTEM-typed organization is normalized to the same
 * `NOT_FOUND` as an inaccessible one, excluded until STORY-003-004 defines a
 * Platform-administrator authorization model — this is defense-in-depth
 * only, since no flow in this codebase ever creates a documented OWNER
 * membership in the SYSTEM organization.
 */
export class UpdateOrganizationUseCase {
  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly verifyOwnerMembership: VerifyOwnerMembershipService,
    private readonly sessionVerifier: SessionVerifier,
  ) {}

  async execute(
    accessToken: string,
    command: UpdateOrganizationCommand,
  ): Promise<Result<UpdateOrganizationResult, UpdateOrganizationError>> {
    const caller = await this.sessionVerifier.verify(accessToken);
    if (!caller.ok) {
      if (caller.error.type === "UNAUTHORIZED") {
        return err({ type: "UNAUTHORIZED" });
      }
      return err({ type: "UNEXPECTED", cause: caller.error.cause });
    }

    const ownerCheck = await this.verifyOwnerMembership({
      userId: caller.value.userId,
      organizationId: command.organizationId,
    });

    if (!ownerCheck.ok) {
      if (ownerCheck.error.type === "NOT_ACTIVE_MEMBER") {
        return err({ type: "NOT_FOUND" });
      }
      if (ownerCheck.error.type === "NOT_OWNER") {
        return err({ type: "FORBIDDEN" });
      }
      return err({ type: "UNEXPECTED", cause: ownerCheck.error.cause });
    }

    const organization = await this.organizationRepository.findById(command.organizationId);
    if (!organization) {
      return err({ type: "NOT_FOUND" });
    }

    if (organization.organizationType === "SYSTEM") {
      return err({ type: "NOT_FOUND" });
    }

    if (organization.isSuspended()) {
      return err({ type: "ORGANIZATION_SUSPENDED" });
    }

    const updated = await this.organizationRepository.update(command.organizationId, {
      displayName: command.displayName,
    });

    return ok({ organization: updated });
  }
}
