import type { OrganizationType } from "../value-objects/organization-type";
import type { Slug } from "../value-objects/slug";

export type OrganizationProps = {
  id: string;
  organizationType: OrganizationType;
  slug: Slug;
  displayName: string;
  createdAt: Date;
  /** STORY-003-005 — White Label / branding fields. Nullable; unset until explicitly configured. */
  brandName?: string | null;
  logo?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  /** STORY-003-006 — Organization Settings. Nullable; unset until explicitly configured. */
  supportContactEmail?: string | null;
};

/**
 * Organization (MASTER_SPEC §17/§26.1): the platform's tenant/business/
 * security boundary (ADR-001). Owned exclusively by the Organizations module
 * (ADR-011) — Identity, Billing, and every other module reference an
 * Organization only by id.
 */
export class Organization {
  readonly id: string;
  readonly organizationType: OrganizationType;
  readonly slug: Slug;
  readonly displayName: string;
  readonly createdAt: Date;
  readonly brandName: string | null;
  readonly logo: string | null;
  readonly primaryColor: string | null;
  readonly secondaryColor: string | null;
  readonly supportContactEmail: string | null;

  private constructor(props: OrganizationProps) {
    this.id = props.id;
    this.organizationType = props.organizationType;
    this.slug = props.slug;
    this.displayName = props.displayName;
    this.createdAt = props.createdAt;
    this.brandName = props.brandName ?? null;
    this.logo = props.logo ?? null;
    this.primaryColor = props.primaryColor ?? null;
    this.secondaryColor = props.secondaryColor ?? null;
    this.supportContactEmail = props.supportContactEmail ?? null;
  }

  /**
   * STORY-003-001 — Create Organization always creates a PARTNER
   * organization; SYSTEM is seeded platform-side, never through this
   * contract.
   */
  static create(params: { id: string; displayName: string; slug: Slug }): Organization {
    return new Organization({
      id: params.id,
      organizationType: "PARTNER",
      slug: params.slug,
      displayName: params.displayName,
      createdAt: new Date(),
    });
  }

  static fromPersistence(props: OrganizationProps): Organization {
    return new Organization(props);
  }
}
