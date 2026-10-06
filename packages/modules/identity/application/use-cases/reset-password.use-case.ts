import { err, ok, type Result } from "@allinvites/kernel";
import { InvalidPasswordError } from "../../domain/exceptions/invalid-password.error";
import { InvalidRecoveryTokenError } from "../../domain/exceptions/invalid-recovery-token.error";
import { Password } from "../../domain/value-objects/password";
import type { ResetPasswordCommand } from "../commands/reset-password.command";
import type { PasswordRecoveryProvider } from "../ports/password-recovery-provider";

export type ResetPasswordError =
  | InvalidPasswordError
  | InvalidRecoveryTokenError
  | { readonly type: "UNEXPECTED"; readonly cause: unknown };

/**
 * STORY-002-004 — `POST /auth/reset-password`. The new password goes
 * through the same Password value object (8-72 chars, MASTER_SPEC §30) used
 * at registration — resetting is itself an act of establishing a new
 * password, not checking an existing credential (unlike Login).
 */
export class ResetPasswordUseCase {
  constructor(private readonly provider: PasswordRecoveryProvider) {}

  async execute(command: ResetPasswordCommand): Promise<Result<void, ResetPasswordError>> {
    let password: Password;
    try {
      password = Password.create(command.newPassword);
    } catch (error) {
      if (error instanceof InvalidPasswordError) {
        return err(error);
      }
      throw error;
    }

    const result = await this.provider.resetPassword({
      email: command.email.trim().toLowerCase(),
      token: command.token,
      newPassword: password.value,
    });

    if (!result.ok) {
      if (result.error.type === "INVALID_OR_EXPIRED_TOKEN") {
        return err(new InvalidRecoveryTokenError());
      }
      return err({ type: "UNEXPECTED", cause: result.error.cause });
    }

    return ok(undefined);
  }
}
