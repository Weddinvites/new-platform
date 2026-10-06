import { DomainError } from "@allinvites/kernel";

/**
 * Never include the offending password value in the message — passwords
 * must never appear in logs or error output (DEVELOPMENT_RULES.md §20).
 */
export class InvalidPasswordError extends DomainError {
  readonly code = "INVALID_PASSWORD";

  constructor(reason: string) {
    super(`Invalid password: ${reason}`);
  }
}
