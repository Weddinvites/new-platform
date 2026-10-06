import { DomainError } from "@allinvites/kernel";

/**
 * Matches API_SPEC.md §21a "Existing Authentication Endpoints" —
 * `POST /auth/reset-password`'s documented `INVALID_OR_EXPIRED_TOKEN`.
 * Deliberately a distinct class from InvalidInvitationTokenError (a
 * different token/business concept) even though the wire code coincides.
 */
export class InvalidRecoveryTokenError extends DomainError {
  readonly code = "INVALID_OR_EXPIRED_TOKEN";

  constructor() {
    super("The password recovery token is invalid or has expired.");
  }
}
