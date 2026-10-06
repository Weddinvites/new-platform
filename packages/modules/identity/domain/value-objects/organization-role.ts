/**
 * Canonical role vocabulary, approved in MASTER_SPEC §18. No other role name
 * (e.g. "Planner", "Editor", "Viewer", "Organization Administrator") is valid.
 */
export const ORGANIZATION_ROLES = ["OWNER", "ADMIN", "MEMBER", "CLIENT"] as const;

export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export function isOrganizationRole(value: string): value is OrganizationRole {
  return (ORGANIZATION_ROLES as readonly string[]).includes(value);
}
