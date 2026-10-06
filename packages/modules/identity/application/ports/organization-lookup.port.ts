/**
 * Narrow read-only port used only to resolve the SYSTEM organization's id
 * for the default B2C registration path (API_SPEC.md §21a "Registration
 * Decisions"). The Organizations module owns the Organization entity
 * (MASTER_SPEC §26.1) but does not exist yet; this port reads the shared
 * `organizations` table directly rather than inventing a dependency on a
 * module that isn't implemented.
 */
export interface OrganizationLookupPort {
  findIdBySlug(slug: string): Promise<string | null>;
}
