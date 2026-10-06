import { DomainError } from "@allinvites/kernel";

/**
 * Matches API_SPEC.md §23 "Change Password" — reuses the `INVALID_CREDENTIALS`
 * code already documented for `POST /auth/login`, rather than a distinct
 * code. Deliberately a separate class from InvalidCredentialsError: the
 * caller here is already an authenticated identity (verified via a Bearer
 * token), so the message does not need to hedge about email existence, only
 * about not distinguishing "wrong password" from any other verification
 * outcome.
 */
export class InvalidCurrentPasswordError extends DomainError {
  readonly code = "INVALID_CREDENTIALS";

  constructor() {
    super("The current password is incorrect.");
  }
}
