import { InvalidPasswordError } from "../exceptions/invalid-password.error";

const MIN_LENGTH = 8;
const MAX_LENGTH = 72;

/**
 * Password value object. Per API_SPEC.md §21a "Registration Decisions" and
 * MASTER_SPEC §30: 8-72 characters, no forced composition rules for MVP.
 *
 * Holds the plaintext only long enough to be handed to the AuthProvider
 * port, which delegates hashing to Supabase Auth (Argon2 or equivalent).
 * This value is never persisted by the Identity module's own repositories
 * and must never appear in logs (DEVELOPMENT_RULES.md §20).
 */
export class Password {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(raw: string): Password {
    if (raw.length < MIN_LENGTH) {
      throw new InvalidPasswordError(`must be at least ${MIN_LENGTH} characters.`);
    }

    if (raw.length > MAX_LENGTH) {
      throw new InvalidPasswordError(`must be at most ${MAX_LENGTH} characters.`);
    }

    return new Password(raw);
  }

  toString(): string {
    return "[REDACTED]";
  }
}
