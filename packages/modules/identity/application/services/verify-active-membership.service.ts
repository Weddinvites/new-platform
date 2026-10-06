import { err, ok, type Result } from "@allinvites/kernel";
import type { OrganizationMembershipRepository } from "../../domain/repositories/organization-membership-repository";

export type VerifyActiveMembershipParams = {
  readonly userId: string;
  readonly organizationId: string;
};

export type VerifyActiveMembershipError =
  | { readonly type: "NOT_A_MEMBER" }
  | { readonly type: "UNEXPECTED"; readonly cause: unknown };

export type VerifyActiveMembershipService = (
  params: VerifyActiveMembershipParams,
) => Promise<Result<void, VerifyActiveMembershipError>>;

/**
 * STORY-003-002 (Organizations) — one of the two new additions to Identity's
 * public surface required by this Story. Fail-secure: a missing, SUSPENDED,
 * or REMOVED membership is reported identically as `NOT_A_MEMBER`, never
 * distinguishing which, matching the same convention already established by
 * `resolveOrganizationContext` (STORY-002-008). Returns only the membership
 * fact — never the caller's role, since nothing in the approved
 * STORY-003-002 contract needs it.
 */
export function createVerifyActiveMembershipService(
  organizationMembershipRepository: OrganizationMembershipRepository,
): VerifyActiveMembershipService {
  return async function verifyActiveMembership(params) {
    try {
      const membership = await organizationMembershipRepository.findByUserAndOrganization(
        params.userId,
        params.organizationId,
      );

      if (membership?.status !== "ACTIVE") {
        return err({ type: "NOT_A_MEMBER" });
      }

      return ok(undefined);
    } catch (error) {
      return err({ type: "UNEXPECTED", cause: error });
    }
  };
}
