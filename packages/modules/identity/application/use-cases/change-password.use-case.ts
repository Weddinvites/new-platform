import { err, ok, type Result } from "@allinvites/kernel";
import { InvalidCurrentPasswordError } from "../../domain/exceptions/invalid-current-password.error";
import { InvalidPasswordError } from "../../domain/exceptions/invalid-password.error";
import type { UserRepository } from "../../domain/repositories/user-repository";
import { Password } from "../../domain/value-objects/password";
import type { ChangePasswordCommand } from "../commands/change-password.command";
import type { AuthSessionProvider } from "../ports/auth-provider";
import type { PasswordRecoveryProvider } from "../ports/password-recovery-provider";
import type { SessionProvider } from "../ports/session-provider";

export type ChangePasswordError =
  | { readonly type: "UNAUTHORIZED" }
  | InvalidPasswordError
  | InvalidCurrentPasswordError
  | { readonly type: "UNEXPECTED"; readonly cause: unknown };

/**
 * STORY-002-004 — `POST /auth/change-password`. Identifies the caller via
 * the existing SessionProvider, verifies the supplied current password by
 * reusing AuthSessionProvider.signIn (the same primitive Login already uses
 * to verify credentials — no new verification mechanism was introduced),
 * then sets the new password via PasswordRecoveryProvider.updatePassword.
 */
export class ChangePasswordUseCase {
  constructor(
    private readonly sessionProvider: SessionProvider,
    private readonly userRepository: UserRepository,
    private readonly authSessionProvider: AuthSessionProvider,
    private readonly passwordRecoveryProvider: PasswordRecoveryProvider,
  ) {}

  async execute(
    accessToken: string,
    command: ChangePasswordCommand,
  ): Promise<Result<void, ChangePasswordError>> {
    const identity = await this.sessionProvider.getUserFromAccessToken(accessToken);

    if (!identity.ok) {
      if (identity.error.type === "UNAUTHORIZED") {
        return err({ type: "UNAUTHORIZED" });
      }
      return err({ type: "UNEXPECTED", cause: identity.error.cause });
    }

    const user = await this.userRepository.findById(identity.value.id);
    if (!user) {
      // Same reasoning as ResolveCurrentUserUseCase: a valid token with no
      // matching local profile is a data-consistency bug, not a caller
      // authentication failure.
      return err({
        type: "UNEXPECTED",
        cause: new Error(`No User profile found for authenticated id ${identity.value.id}.`),
      });
    }

    let newPassword: Password;
    try {
      newPassword = Password.create(command.newPassword);
    } catch (error) {
      if (error instanceof InvalidPasswordError) {
        return err(error);
      }
      throw error;
    }

    const verified = await this.authSessionProvider.signIn({
      email: user.email.value,
      password: command.currentPassword,
    });

    if (!verified.ok) {
      if (verified.error.type === "INVALID_CREDENTIALS") {
        return err(new InvalidCurrentPasswordError());
      }
      return err({ type: "UNEXPECTED", cause: verified.error.cause });
    }

    const updated = await this.passwordRecoveryProvider.updatePassword(user.id, newPassword.value);

    if (!updated.ok) {
      return err({ type: "UNEXPECTED", cause: updated.error.cause });
    }

    return ok(undefined);
  }
}
