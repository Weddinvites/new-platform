/**
 * Public wire contract for POST /api/v1/management/organizations, matching
 * API_SPEC.md §22 "Create Organization" exactly (snake_case field names,
 * matching the documented JSON schema).
 */
export type CreateOrganizationRequestDto = {
  display_name: string;
  slug?: string;
};

export type CreatedOrganizationDto = {
  id: string;
  organization_type: "PARTNER";
  slug: string;
  display_name: string;
  created_at: string;
  membership: {
    id: string;
    organization_id: string;
    role: "OWNER";
    status: "ACTIVE";
  };
};
