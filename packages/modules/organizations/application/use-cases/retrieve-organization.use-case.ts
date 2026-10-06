import { err, ok, type Result } from "@allinvites/kernel";
import type { VerifyActiveMembershipService } from "@allinvites/module-identity";
import type { Organization } from "../../domain/entities/organization";
import type { OrganizationRepository } from "../../domain/repositories/organization-repository";
import type { PlatformPrivilegeVerifier } from "../ports/platform-privilege-verifier";
import type { SessionVerifier } from "../ports/session-verifier";

export type RetrieveOrganizationError =
  | { readonly type: "UNAUTHORIZED" }
  | { readonly type: "NOT_FOUND" }
  | { readonly type: "ORGANIZATION_SUSPENDED" }
  | { readonly type: "UNEXPECTED"; readonly cause: unknown };

export type RetrieveOrganizationResult = {
  readonly organization: Organization;
};

/**
 * STORY-003-002 — Retrieve Organization (EPIC_003_ORGANIZATIONS.md §5).
 * Authorization is delegated to Identity's `verifyActiveMembership`
 * (ADR-011: Organizations never touches OrganizationMembership internals or
 * the organization_memberships table directly). A nonexistent
 * `organizationId` and an existing one the caller has no ACTIVE membership
 * in both collapse to the same `NOT_FOUND`.
 *
 * STORY-003-004 — a platform-privileged caller with no membership in the
 * target may also retrieve it (API_SPEC.md §22 "Platform visibility"). The
 * platform check runs only after membership fails, so a membership-holder's
 * path is unchanged. Suspension is checked after access is established, for
 * every caller, platform-privileged or not.
 */
export class RetrieveOrganizationUseCase {
  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly verifyActiveMembership: VerifyActiveMembershipService,
    private readonly sessionVerifier: SessionVerifier,
    private readonly isPlatformPrivileged: PlatformPrivilegeVerifier = async () => false,
  ) {}

  async execute(
    accessToken: string,
    organizationId: string,
  ): Promise<Result<RetrieveOrganizationResult, RetrieveOrganizationError>> {
    const caller = await this.sessionVerifier.verify(accessToken);
    if (!caller.ok) {
      if (caller.error.type === "UNAUTHORIZED") {
        return err({ type: "UNAUTHORIZED" });
      }
      return err({ type: "UNEXPECTED", cause: caller.error.cause });
    }

    const membershipCheck = await this.verifyActiveMembership({
      userId: caller.value.userId,
      organizationId,
    });

    if (!membershipCheck.ok) {
      if (membershipCheck.error.type !== "NOT_A_MEMBER") {
        return err({ type: "UNEXPECTED", cause: membershipCheck.error.cause });
      }

      let privileged: boolean;
      try {
        privileged = await this.isPlatformPrivileged({ userId: caller.value.userId });
      } catch (error) {
        return err({ type: "UNEXPECTED", cause: error });
      }
      if (!privileged) {
        return err({ type: "NOT_FOUND" });
      }
    }

    const organization = await this.organizationRepository.findById(organizationId);
    if (!organization) {
      return err({ type: "NOT_FOUND" });
    }

    if (organization.isSuspended()) {
      return err({ type: "ORGANIZATION_SUSPENDED" });
    }

    return ok({ organization });
  }
}
