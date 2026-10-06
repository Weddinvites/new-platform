/**
 * Public wire contract shared by Retrieve Organization and List Organizations
 * (API_SPEC.md §22; STORY-003-002), matching the documented JSON schema
 * exactly. Never includes membership details (role, status, membership id).
 */
export type OrganizationDto = {
  id: string;
  organization_type: "SYSTEM" | "PARTNER";
  slug: string;
  display_name: string;
  created_at: string;
};

export type PaginationDto = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};
