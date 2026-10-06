import type { VerifyPlatformPrivilegeService } from "@allinvites/module-identity";
import type { PlatformPrivilegeVerifier } from "../../application/ports/platform-privilege-verifier";
import type { OrganizationStatusRepository } from "../../domain/repositories/organization-status-repository";

/**
 * Adapts Identity's `verifyPlatformPrivilege` (ADR-011: Identity owns the
 * membership check) to Organizations' `PlatformPrivilegeVerifier` port. The
 * SYSTEM organization id is resolved here, from Organizations' own table, so
 * Identity never has to read organizations. If no SYSTEM organization exists,
 * no caller is platform-privileged.
 */
export function createIdentityPlatformPrivilegeVerifier(
  organizations: Pick<OrganizationStatusRepository, "findSystemOrganization">,
  verifyPlatformPrivilege: VerifyPlatformPrivilegeService,
): PlatformPrivilegeVerifier {
  return async ({ userId }) => {
    const system = await organizations.findSystemOrganization();
    if (!system) {
      return false;
    }

    const result = await verifyPlatformPrivilege({
      userId,
      systemOrganizationId: system.id,
    });

    if (result.ok) {
      return true;
    }
    if (result.error.type === "NOT_PLATFORM_PRIVILEGED") {
      return false;
    }
    throw result.error.cause;
  };
}
