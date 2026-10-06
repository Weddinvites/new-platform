import { DomainError } from "@allinvites/kernel";

export class InvalidEmailError extends DomainError {
  readonly code = "INVALID_EMAIL";

  constructor(value: string) {
    super(`"${value}" is not a valid email address.`);
  }
}
