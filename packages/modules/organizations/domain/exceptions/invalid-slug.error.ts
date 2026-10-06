import { DomainError } from "@allinvites/kernel";

/**
 * Raised when a supplied or derived slug normalizes (STORY-003-001's
 * lowercase-kebab-case policy) to an empty string — there is no usable
 * candidate left, distinct from a slug collision (see
 * OrganizationSlugAlreadyExistsError).
 */
export class InvalidSlugError extends DomainError {
  readonly code = "INVALID_SLUG";

  constructor() {
    super("The organization slug is invalid.");
  }
}
