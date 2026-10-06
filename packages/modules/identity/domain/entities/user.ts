import type { Email } from "../value-objects/email";
import type { FullName } from "../value-objects/full-name";

export type UserProps = {
  id: string;
  email: Email;
  fullName: FullName;
  emailVerified: boolean;
  createdAt: Date;
};

/**
 * User aggregate root (MASTER_SPEC §26.2). `id` is the Supabase Auth user
 * id — the User entity never owns authentication credentials itself; it
 * only owns the application-level profile (MASTER_SPEC §28.1 Identity Module).
 */
export class User {
  readonly id: string;
  readonly email: Email;
  readonly fullName: FullName;
  readonly emailVerified: boolean;
  readonly createdAt: Date;

  private constructor(props: UserProps) {
    this.id = props.id;
    this.email = props.email;
    this.fullName = props.fullName;
    this.emailVerified = props.emailVerified;
    this.createdAt = props.createdAt;
  }

  /**
   * Registers a new User. `id` must already exist as an authenticated
   * identity (created via the AuthProvider port) — per API_SPEC.md §21a,
   * a new account starts with `email_verified: false`.
   */
  static register(params: {
    id: string;
    email: Email;
    fullName: FullName;
    createdAt?: Date;
  }): User {
    return new User({
      id: params.id,
      email: params.email,
      fullName: params.fullName,
      emailVerified: false,
      createdAt: params.createdAt ?? new Date(),
    });
  }

  static fromPersistence(props: UserProps): User {
    return new User(props);
  }
}
