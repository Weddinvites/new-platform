/**
 * Public wire contract for Retrieve/Update Organization Branding
 * (API_SPEC.md §22 "Configure White Label"; STORY-003-005). A standalone
 * DTO — never merged into `OrganizationDto` (STORY-003-002), which remains
 * unchanged.
 */
export type OrganizationBrandingDto = {
  organization_id: string;
  brand_name: string | null;
  logo: string | null;
  primary_color: string | null;
  secondary_color: string | null;
};
