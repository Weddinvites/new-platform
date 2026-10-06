import { DomainError } from "@allinvites/kernel";

/**
 * Matches API_SPEC.md §21a "Existing Authentication Endpoints" —
 * INVALID_CREDENTIALS. The message must never reveal whether the email
 * exists (same wording regardless of cause).
 */
export class InvalidCredentialsError extends DomainError {
  readonly code = "INVALID_CREDENTIALS";

  constructor() {
    super("Invalid email or password.");
  }
}
