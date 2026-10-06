import type { OrganizationRole } from "../domain/value-objects/organization-role";

/**
 * Public wire contract for POST /api/v1/management/users/invitations
 * (STORY-002-007 approved contract).
 */
export type InviteUserRequestDto = {
  email: string;
  role: OrganizationRole;
};

export type InvitationDto = {
  id: string;
  email: string;
  role: OrganizationRole;
  organization_id: string;
  status: "PENDING";
  expires_at: string;
};
