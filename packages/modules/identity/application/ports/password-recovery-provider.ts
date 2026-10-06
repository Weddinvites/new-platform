import type { Result } from "@allinvites/kernel";

export type PasswordRecoveryError = {
  readonly type: "UNEXPECTED";
  readonly cause: unknown;
};

export type ResetPasswordError =
  | { readonly type: "INVALID_OR_EXPIRED_TOKEN" }
  | { readonly type: "UNEXPECTED"; readonly cause: unknown };

/**
 * Port for the Password Recovery flow (STORY-002-004). Deliberately
 * separate from AuthProvider/AuthSessionProvider/SessionProvider (Interface
 * Segregation) — implementing this required no changes to any of those
 * already-approved ports. Implemented by SupabaseAuthProvider.
 */
export interface PasswordRecoveryProvider {
  /**
   * Always resolves `ok()` once the request reaches the provider, regardless
   * of whether `email` corresponds to an existing account — API_SPEC.md
   * §21a: "returned regardless of whether the account exists." Only a
   * genuine technical/infrastructure failure surfaces as an error.
   */
  initiateRecovery(email: string): Promise<Result<void, PasswordRecoveryError>>;

  /** Verifies the recovery token for `email` and sets the new password. */
  resetPassword(params: {
    email: string;
    token: string;
    newPassword: string;
  }): Promise<Result<void, ResetPasswordError>>;

  /**
   * Sets a new password directly by user id (STORY-002-004 — Change
   * Password). Current-password verification happens separately, via
   * AuthSessionProvider — this method only performs the write.
   */
  updatePassword(userId: string, newPassword: string): Promise<Result<void, PasswordRecoveryError>>;
}
