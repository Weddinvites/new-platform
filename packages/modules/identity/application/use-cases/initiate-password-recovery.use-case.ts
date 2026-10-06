import { err, ok, type Result } from "@allinvites/kernel";
import type { PasswordRecoveryProvider } from "../ports/password-recovery-provider";

export type InitiatePasswordRecoveryError = {
  readonly type: "UNEXPECTED";
  readonly cause: unknown;
};

/**
 * STORY-002-004 — `POST /auth/forgot-password`. Always succeeds from the
 * caller's perspective regardless of whether `email` matches an account
 * (API_SPEC.md §21a) — there is no branch here that could reveal account
 * existence; only a genuine provider-level technical failure returns an
 * error.
 */
export class InitiatePasswordRecoveryUseCase {
  constructor(private readonly provider: PasswordRecoveryProvider) {}

  async execute(email: string): Promise<Result<void, InitiatePasswordRecoveryError>> {
    const normalizedEmail = email.trim().toLowerCase();

    const result = await this.provider.initiateRecovery(normalizedEmail);

    if (!result.ok) {
      return err({ type: "UNEXPECTED", cause: result.error.cause });
    }

    return ok(undefined);
  }
}
