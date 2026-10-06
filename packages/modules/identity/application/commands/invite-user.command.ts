import type { OrganizationRole } from "../../domain/value-objects/organization-role";

export type InviteUserCommand = {
  organizationId: string;
  email: string;
  role: OrganizationRole;
};
