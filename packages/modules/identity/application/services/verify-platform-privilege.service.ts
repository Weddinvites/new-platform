import { err, ok, type Result } from "@allinvites/kernel";
import type { OrganizationMembershipRepository } from "../../domain/repositories/organization-membership-repository";

export type VerifyPlatformPrivilegeParams = {
  readonly userId: string;
  /** The SYSTEM organization's id (MASTER_SPEC §17, "Agencia 0"), resolved by the caller. */
  readonly systemOrganizationId: string;
};

export type VerifyPlatformPrivilegeError =
  | { readonly type: "NOT_PLATFORM_PRIVILEGED" }
  | { readonly type: "UNEXPECTED"; readonly cause: unknown };

export type VerifyPlatformPrivilegeService = (
  params: VerifyPlatformPrivilegeParams,
) => Promise<Result<void, VerifyPlatformPrivilegeError>>;

/**
 * STORY-003-004 (Organizations) — new addition to Identity's public surface.
 * A platform-privileged User holds an ACTIVE membership in the SYSTEM
 * organization with role OWNER or ADMIN (API_SPEC.md §22 "Platform Privilege
 * Definition"). MEMBER and CLIENT in SYSTEM confer nothing. Any other state
 * (no membership, SUSPENDED, REMOVED, or a non-privileged role) is reported
 * as the single `NOT_PLATFORM_PRIVILEGED`. Returns only success or failure,
 * never the membership entity, the role, or RBAC internals.
 */
export function createVerifyPlatformPrivilegeService(
  organizationMembershipRepository: OrganizationMembershipRepository,
): VerifyPlatformPrivilegeService {
  return async function verifyPlatformPrivilege(params) {
    try {
      const membership = await organizationMembershipRepository.findByUserAndOrganization(
        params.userId,
        params.systemOrganizationId,
      );

      if (
        membership?.status !== "ACTIVE" ||
        (membership.role !== "OWNER" && membership.role !== "ADMIN")
      ) {
        return err({ type: "NOT_PLATFORM_PRIVILEGED" });
      }

      return ok(undefined);
    } catch (error) {
      return err({ type: "UNEXPECTED", cause: error });
    }
  };
}
