import { InvalidEmailError } from "../exceptions/invalid-email.error";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Email value object. Normalizes to lowercase so equality and uniqueness
 * checks are case-insensitive, matching standard email semantics.
 */
export class Email {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(raw: string): Email {
    const normalized = raw.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(normalized)) {
      throw new InvalidEmailError(raw);
    }

    return new Email(normalized);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
