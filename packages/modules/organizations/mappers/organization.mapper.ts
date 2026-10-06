import type { CreateOrganizationResult } from "../application/use-cases/create-organization.use-case";
import type { CreatedOrganizationDto } from "../contracts/create-organization.dto";
import type { OrganizationDto } from "../contracts/organization.dto";
import type { OrganizationBrandingDto } from "../contracts/organization-branding.dto";
import type { OrganizationSettingsDto } from "../contracts/organization-settings.dto";
import type { Organization } from "../domain/entities/organization";

/** STORY-003-002 — Retrieve Organization / List Organizations. Never includes membership details. */
export function toOrganizationDto(organization: Organization): OrganizationDto {
  return {
    id: organization.id,
    organization_type: organization.organizationType,
    slug: organization.slug.value,
    display_name: organization.displayName,
    created_at: organization.createdAt.toISOString(),
  };
}

/** STORY-003-004 — Activate / Suspend Organization. Returns only the id and the resulting status. */
export function toOrganizationStatusDto(organization: Organization): {
  id: string;
  organization_status: "ACTIVE" | "SUSPENDED";
} {
  return {
    id: organization.id,
    organization_status: organization.organizationStatus,
  };
}

/** STORY-003-005 — Retrieve/Update Organization Branding. A standalone DTO, not merged into OrganizationDto. */
export function toOrganizationBrandingDto(organization: Organization): OrganizationBrandingDto {
  return {
    organization_id: organization.id,
    brand_name: organization.brandName,
    logo: organization.logo,
    primary_color: organization.primaryColor,
    secondary_color: organization.secondaryColor,
  };
}

/** STORY-003-006 — Retrieve/Update Organization Settings. A standalone DTO, not merged into OrganizationDto or OrganizationBrandingDto. */
export function toOrganizationSettingsDto(organization: Organization): OrganizationSettingsDto {
  return {
    organization_id: organization.id,
    support_contact_email: organization.supportContactEmail,
  };
}

export function toCreatedOrganizationDto(result: CreateOrganizationResult): CreatedOrganizationDto {
  return {
    id: result.organization.id,
    // STORY-003-001 only ever creates PARTNER organizations (Organization.create).
    organization_type: "PARTNER",
    slug: result.organization.slug.value,
    display_name: result.organization.displayName,
    created_at: result.organization.createdAt.toISOString(),
    membership: {
      id: result.membershipId,
      organization_id: result.organization.id,
      role: "OWNER",
      status: "ACTIVE",
    },
  };
}
