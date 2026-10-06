import { DomainError } from "@allinvites/kernel";

/**
 * Matches API_SPEC.md §22 "Create Organization" —
 * ORGANIZATION_SLUG_ALREADY_EXISTS (409). The database's unique constraint
 * on organizations.slug is the sole enforcement mechanism (STORY-003-001
 * approved slug policy) — this error is raised from that constraint
 * violation, not a redundant pre-check.
 */
export class OrganizationSlugAlreadyExistsError extends DomainError {
  readonly code = "ORGANIZATION_SLUG_ALREADY_EXISTS";

  constructor() {
    super("An organization with this slug already exists.");
  }
}
