import type { OrganizationRole } from "../domain/value-objects/organization-role";

/**
 * Public wire contract for POST /api/v1/management/users/{userId}/role
 * (STORY-002-007 approved contract).
 */
export type AssignUserRoleRequestDto = {
  role: OrganizationRole;
};
