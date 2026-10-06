import { InvalidFullNameError } from "../exceptions/invalid-full-name.error";

const MAX_LENGTH = 200;

export class FullName {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(raw: string): FullName {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidFullNameError("must not be empty.");
    }

    if (trimmed.length > MAX_LENGTH) {
      throw new InvalidFullNameError(`must be at most ${MAX_LENGTH} characters.`);
    }

    return new FullName(trimmed);
  }

  toString(): string {
    return this.value;
  }
}
