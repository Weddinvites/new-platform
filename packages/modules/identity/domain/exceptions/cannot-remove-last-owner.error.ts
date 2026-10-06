import { DomainError } from "@allinvites/kernel";

/**
 * STORY-002-007 — last-OWNER invariant: an organization must never be left
 * without an active OWNER.
 */
export class CannotRemoveLastOwnerError extends DomainError {
  readonly code = "CANNOT_REMOVE_LAST_OWNER";

  constructor() {
    super("The last remaining owner of this organization cannot be removed.");
  }
}
