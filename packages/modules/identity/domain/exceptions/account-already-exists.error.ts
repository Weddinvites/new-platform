import { DomainError } from "@allinvites/kernel";

/**
 * Matches API_SPEC.md §21a "Registration" — ACCOUNT_ALREADY_EXISTS.
 */
export class AccountAlreadyExistsError extends DomainError {
  readonly code = "ACCOUNT_ALREADY_EXISTS";

  constructor() {
    super("An account already exists for this email address.");
  }
}
