import { AuthorizationPolicy } from "./authorization-policy";
import { RolePermissionRegistry } from "./role-permission-registry";
import { TeamManagementPermissions } from "./team-management-permissions";

/**
 * STORY-002-007 — populates the STORY-002-006 RBAC mechanism with exactly
 * the 7 permissions this Story needs, granted to OWNER only. ADMIN, MEMBER
 * and CLIENT receive none of them for this Story (MASTER_SPEC §18 only
 * documents OWNER as administering "Usuarios"; extending any of these to
 * ADMIN is an explicit future decision, not made here). Does not modify
 * AuthorizationPolicy or RolePermissionRegistry — only instantiates and
 * seeds them, exactly as STORY-002-006 was designed to be consumed.
 */
export function createTeamManagementAuthorizationPolicy(): AuthorizationPolicy {
  const registry = new RolePermissionRegistry();

  for (const permission of Object.values(TeamManagementPermissions)) {
    registry.grant("OWNER", permission);
  }

  return new AuthorizationPolicy(registry);
}
