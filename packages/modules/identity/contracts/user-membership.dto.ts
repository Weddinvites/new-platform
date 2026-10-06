import type { MembershipStatus } from "../domain/value-objects/membership-status";
import type { OrganizationRole } from "../domain/value-objects/organization-role";

/**
 * Public wire contract shared by GET /api/v1/management/users/{userId} and
 * GET /api/v1/management/users (STORY-002-007 approved contract): "the
 * user's identity plus their membership/role in the requested organization
 * context."
 */
export type UserMembershipDto = {
  id: string;
  email: string;
  full_name: string;
  email_verified: boolean;
  organization_id: string;
  role: OrganizationRole;
  status: MembershipStatus;
};
