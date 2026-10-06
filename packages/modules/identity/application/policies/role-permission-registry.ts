import type { OrganizationRole } from "../../domain/value-objects/organization-role";
import type { Permission } from "./permission";

/**
 * STORY-002-006 — RBAC Foundation. The Role → Permission association
 * mechanism required by MASTER_SPEC §28.1 "Nota de Permisos". Deliberately
 * starts empty and stays empty unless a caller explicitly grants something
 * — no permission is seeded here, since no permission catalog has been
 * approved. Fail-secure: an unrecognized role/permission pair is denied.
 */
export class RolePermissionRegistry {
  private readonly grantsByRole = new Map<OrganizationRole, Set<Permission>>();

  grant(role: OrganizationRole, permission: Permission): void {
    const grants = this.grantsByRole.get(role) ?? new Set<Permission>();
    grants.add(permission);
    this.grantsByRole.set(role, grants);
  }

  hasPermission(role: OrganizationRole, permission: Permission): boolean {
    return this.grantsByRole.get(role)?.has(permission) ?? false;
  }
}
