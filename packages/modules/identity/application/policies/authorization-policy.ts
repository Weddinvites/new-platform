import type { OrganizationMembership } from "../../domain/entities/organization-membership";
import type { Permission } from "./permission";
import type { RolePermissionRegistry } from "./role-permission-registry";

/**
 * STORY-002-006 — RBAC Foundation. Evaluates whether an authenticated
 * user's Organization Membership grants a given permission, per the
 * approved multi-organization membership model (MASTER_SPEC §18; ADR-001):
 * the role a permission is checked against always comes from a specific
 * Organization Membership, never a bare/global role. Fail-secure: any
 * combination not explicitly granted in the registry is denied. Not wired
 * into any Route Handler — no currently-implemented endpoint requires
 * role-gating yet.
 */
export class AuthorizationPolicy {
  constructor(private readonly registry: RolePermissionRegistry) {}

  authorize(membership: OrganizationMembership, permission: Permission): boolean {
    return this.registry.hasPermission(membership.role, permission);
  }
}
