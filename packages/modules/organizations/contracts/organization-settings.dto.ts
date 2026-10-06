/**
 * Public wire contract for Retrieve/Update Organization Settings
 * (API_SPEC.md §22 "Retrieve/Update Organization Settings"; STORY-003-006).
 * A standalone DTO — never merged into `OrganizationDto` (STORY-003-002) or
 * `OrganizationBrandingDto` (STORY-003-005), both of which remain unchanged.
 */
export type OrganizationSettingsDto = {
  organization_id: string;
  support_contact_email: string | null;
};
