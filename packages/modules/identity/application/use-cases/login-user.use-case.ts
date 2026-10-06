import { err, ok, type Result } from "@allinvites/kernel";
import {
  type UserAuthenticatedEvent,
  userAuthenticatedEvent,
} from "../../domain/events/user-authenticated.event";
import { InvalidCredentialsError } from "../../domain/exceptions/invalid-credentials.error";
import type { LoginUserCommand } from "../commands/login-user.command";
import type { AuthSession, AuthSessionProvider } from "../ports/auth-provider";

export type LoginUserError =
  | InvalidCredentialsError
  | { readonly type: "UNEXPECTED"; readonly cause: unknown };

export type LoginUserResult = {
  readonly session: AuthSession;
  readonly event: UserAuthenticatedEvent;
};

/**
 * STORY-002-002 — User Login. Implements API_SPEC.md §21a
 * `POST /auth/login`: authenticates an existing User and establishes a
 * session. No repository lookup is performed here — Supabase Auth is the
 * sole arbiter of credential validity, so there is exactly one code path
 * for "no such user" and "wrong password," satisfying the documented
 * requirement that INVALID_CREDENTIALS never reveals which case occurred.
 */
export class LoginUserUseCase {
  constructor(private readonly authSessionProvider: AuthSessionProvider) {}

  async execute(command: LoginUserCommand): Promise<Result<LoginUserResult, LoginUserError>> {
    // Matches the normalization Email.create() applies at registration, so
    // login succeeds regardless of casing against the stored account.
    const email = command.email.trim().toLowerCase();

    const signInResult = await this.authSessionProvider.signIn({
      email,
      password: command.password,
    });

    if (!signInResult.ok) {
      if (signInResult.error.type === "INVALID_CREDENTIALS") {
        return err(new InvalidCredentialsError());
      }
      return err({ type: "UNEXPECTED", cause: signInResult.error.cause });
    }

    const event = userAuthenticatedEvent({ userId: signInResult.value.id });

    return ok({ session: signInResult.value.session, event });
  }
}
