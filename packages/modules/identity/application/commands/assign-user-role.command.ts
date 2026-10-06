import type { OrganizationRole } from "../../domain/value-objects/organization-role";

export type AssignUserRoleCommand = {
  organizationId: string;
  targetUserId: string;
  role: OrganizationRole;
};
