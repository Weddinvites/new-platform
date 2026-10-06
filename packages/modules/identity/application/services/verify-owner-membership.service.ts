import { err, ok, type Result } from "@allinvites/kernel";
import type { OrganizationMembershipRepository } from "../../domain/repositories/organization-membership-repository";

export type VerifyOwnerMembershipParams = {
  readonly userId: string;
  readonly organizationId: string;
};

export type VerifyOwnerMembershipError =
  | { readonly type: "NOT_ACTIVE_MEMBER" }
  | { readonly type: "NOT_OWNER" }
  | { readonly type: "UNEXPECTED"; readonly cause: unknown };

export type VerifyOwnerMembershipService = (
  params: VerifyOwnerMembershipParams,
) => Promise<Result<void, VerifyOwnerMembershipError>>;

/**
 * STORY-003-003 (Organizations) — new addition to Identity's public surface.
 * A missing, SUSPENDED, or REMOVED membership is reported identically as
 * `NOT_ACTIVE_MEMBER`, mirroring `verifyActiveMembership` (STORY-003-002). An
 * ACTIVE membership whose role is not OWNER is reported as the distinct
 * `NOT_OWNER` — the caller already knows the organization exists once
 * membership is confirmed, so this does not leak anything new. Returns only
 * success/failure — never the membership entity, the caller's actual role,
 * or RBAC internals.
 */
export function createVerifyOwnerMembershipService(
  organizationMembershipRepository: OrganizationMembershipRepository,
): VerifyOwnerMembershipService {
  return async function verifyOwnerMembership(params) {
    try {
      const membership = await organizationMembershipRepository.findByUserAndOrganization(
        params.userId,
        params.organizationId,
      );

      if (membership?.status !== "ACTIVE") {
        return err({ type: "NOT_ACTIVE_MEMBER" });
      }

      if (membership.role !== "OWNER") {
        return err({ type: "NOT_OWNER" });
      }

      return ok(undefined);
    } catch (error) {
      return err({ type: "UNEXPECTED", cause: error });
    }
  };
}
