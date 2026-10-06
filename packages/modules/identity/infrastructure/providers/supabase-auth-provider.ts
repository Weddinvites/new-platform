import { getSupabaseAdminClient, getSupabasePublicClient } from "@allinvites/auth";
import { err, ok, type Result } from "@allinvites/kernel";
import type {
  AuthProvider,
  AuthProviderError,
  AuthSessionProvider,
  CreatedAuthUser,
  SignInError,
} from "../../application/ports/auth-provider";
import type {
  PasswordRecoveryError,
  PasswordRecoveryProvider,
  ResetPasswordError,
} from "../../application/ports/password-recovery-provider";
import type {
  SessionError,
  SessionProvider,
  VerifiedIdentity,
} from "../../application/ports/session-provider";

const ALREADY_REGISTERED_MESSAGE = /already (been )?registered|already exists/i;
const INVALID_CREDENTIALS_MESSAGE = /invalid.*(login )?credentials/i;

/** A missing status (network-level failure) or a 5xx is a genuine backend
 * problem — everything else from `resetPasswordForEmail` must still resolve
 * as success, per the non-enumeration requirement (API_SPEC.md §21a). */
function isTechnicalFailureStatus(status: number | undefined): boolean {
  return status === undefined || status >= 500;
}

/**
 * Supabase's own API returns HTTP 401 for every "you are not validly
 * authenticated" condition on these operations (expired/invalid JWT, no such
 * session, refresh token already used, etc. — see @supabase/auth-js
 * ErrorCode). Anything else (network failure, 5xx) is a genuine technical
 * failure, not a session-validity verdict, so it must not collapse into the
 * same UNAUTHORIZED result.
 */
function isSessionInvalidStatus(status: number | undefined): boolean {
  return status === 401;
}

/**
 * Supabase Auth implementation of AuthProvider. Credential storage and
 * hashing are entirely delegated to Supabase (MASTER_SPEC §30) — this class
 * never persists a password itself.
 *
 * `email_confirm: false` leaves verification non-blocking for MVP
 * (API_SPEC.md §21a "Registration Decisions", point 5): the account is
 * created and usable immediately regardless of verification status. Whether
 * Supabase sends its own confirmation email for admin-created users depends
 * on project-level email settings and should be verified against a live
 * Supabase project before this is considered final.
 *
 * Auto-authentication (point 2) is fulfilled by immediately signing in with
 * the same credentials right after the admin-created account exists, using
 * the anon-key client — the admin API itself does not return a session.
 *
 * Also implements AuthSessionProvider (STORY-002-002 — User Login), reusing
 * the same anon-key client and Supabase call rather than duplicating it.
 *
 * Also implements SessionProvider (STORY-002-003 — Session Management):
 * verifying an access token (`GET /auth/me`), exchanging a refresh token
 * (`POST /auth/refresh`), and revoking a session (`POST /auth/logout`).
 *
 * Also implements PasswordRecoveryProvider (STORY-002-004 — Password
 * Recovery): initiating recovery, completing a reset with a token, and
 * setting a password directly by user id (used by both `resetPassword` and
 * the authenticated `POST /auth/change-password` flow).
 */
export class SupabaseAuthProvider
  implements AuthProvider, AuthSessionProvider, SessionProvider, PasswordRecoveryProvider
{
  async createUser(params: {
    email: string;
    password: string;
    fullName: string;
  }): Promise<Result<CreatedAuthUser, AuthProviderError>> {
    const adminClient = getSupabaseAdminClient();

    const { data, error } = await adminClient.auth.admin.createUser({
      email: params.email,
      password: params.password,
      email_confirm: false,
      user_metadata: { full_name: params.fullName },
    });

    if (error) {
      if (error.code === "email_exists" || ALREADY_REGISTERED_MESSAGE.test(error.message)) {
        return err({ type: "EMAIL_ALREADY_REGISTERED" });
      }
      return err({ type: "UNEXPECTED", cause: error });
    }

    if (!data.user) {
      return err({ type: "UNEXPECTED", cause: new Error("Supabase Auth returned no user.") });
    }

    const { data: signInData, error: signInError } = await this.performSignIn(
      params.email,
      params.password,
    );

    if (signInError || !signInData.session) {
      return err({
        type: "UNEXPECTED",
        cause: signInError ?? new Error("No session returned after sign-in."),
      });
    }

    return ok({
      id: data.user.id,
      session: {
        accessToken: signInData.session.access_token,
        refreshToken: signInData.session.refresh_token,
      },
    });
  }

  /**
   * STORY-002-002 — User Login. Supabase Auth is the sole arbiter of
   * credential validity; there is no separate lookup, so "no such account"
   * and "wrong password" collapse into the same INVALID_CREDENTIALS result.
   *
   * `email_not_confirmed` is deliberately folded into the same
   * INVALID_CREDENTIALS result rather than surfaced as a distinct outcome:
   * API_SPEC.md §21a only documents INVALID_CREDENTIALS/VALIDATION_ERROR for
   * this endpoint (no separate "unverified email" code exists), and
   * Registration Decision #5 requires that an unverified email never block
   * access — so it must not become a 500, and it must not leak a
   * distinguishing signal that would violate the "does not reveal whether
   * the email exists" requirement.
   */
  async signIn(params: {
    email: string;
    password: string;
  }): Promise<Result<CreatedAuthUser, SignInError>> {
    const { data, error } = await this.performSignIn(params.email, params.password);

    if (error) {
      if (
        error.code === "invalid_credentials" ||
        error.code === "email_not_confirmed" ||
        INVALID_CREDENTIALS_MESSAGE.test(error.message)
      ) {
        return err({ type: "INVALID_CREDENTIALS" });
      }
      return err({ type: "UNEXPECTED", cause: error });
    }

    if (!data.user || !data.session) {
      return err({ type: "UNEXPECTED", cause: new Error("Supabase Auth returned no session.") });
    }

    return ok({
      id: data.user.id,
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
      },
    });
  }

  /**
   * STORY-002-003 — `GET /auth/me`. Verifies the access token against
   * Supabase's Auth server (not just decoding the JWT locally), so a
   * revoked/expired token is reliably rejected.
   */
  async getUserFromAccessToken(
    accessToken: string,
  ): Promise<Result<VerifiedIdentity, SessionError>> {
    const publicClient = getSupabasePublicClient();
    const { data, error } = await publicClient.auth.getUser(accessToken);

    if (error || !data.user) {
      if (error && !isSessionInvalidStatus(error.status)) {
        return err({ type: "UNEXPECTED", cause: error });
      }
      return err({ type: "UNAUTHORIZED" });
    }

    return ok({ id: data.user.id });
  }

  /** STORY-002-003 — `POST /auth/refresh`. */
  async refresh(refreshToken: string): Promise<Result<CreatedAuthUser, SessionError>> {
    const publicClient = getSupabasePublicClient();
    const { data, error } = await publicClient.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error) {
      if (!isSessionInvalidStatus(error.status)) {
        return err({ type: "UNEXPECTED", cause: error });
      }
      return err({ type: "UNAUTHORIZED" });
    }

    if (!data.user || !data.session) {
      return err({ type: "UNAUTHORIZED" });
    }

    return ok({
      id: data.user.id,
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
      },
    });
  }

  /**
   * STORY-002-003 — `POST /auth/logout`. Uses the admin API to revoke the
   * session server-side by JWT (there is no client-side "current session" to
   * sign out of in a stateless route handler) — the service-role client is
   * used only internally here, never exposed to the caller.
   */
  async revoke(accessToken: string): Promise<Result<void, SessionError>> {
    const adminClient = getSupabaseAdminClient();
    const { error } = await adminClient.auth.admin.signOut(accessToken);

    if (error) {
      if (!isSessionInvalidStatus(error.status)) {
        return err({ type: "UNEXPECTED", cause: error });
      }
      return err({ type: "UNAUTHORIZED" });
    }

    return ok(undefined);
  }

  /**
   * STORY-002-004 — `POST /auth/forgot-password`. Never distinguishes
   * "no such account" from any other outcome — the only thing that can turn
   * this into an error is a genuine backend/technical failure calling
   * Supabase, per API_SPEC.md §21a's non-enumeration requirement.
   */
  async initiateRecovery(email: string): Promise<Result<void, PasswordRecoveryError>> {
    const publicClient = getSupabasePublicClient();
    const { error } = await publicClient.auth.resetPasswordForEmail(email);

    if (error && isTechnicalFailureStatus(error.status)) {
      return err({ type: "UNEXPECTED", cause: error });
    }

    return ok(undefined);
  }

  /**
   * STORY-002-004 — `POST /auth/reset-password`. Verifies the recovery
   * token via `verifyOtp` (requires the email the token was issued for —
   * the Supabase Auth API surface has no token-only verification for a
   * stateless JSON body), then sets the new password via the admin API
   * using the now-known user id. Using `admin.updateUserById` here (rather
   * than `updateUser` on a signed-in client) avoids any dependency on
   * session state on the shared public client instance.
   */
  async resetPassword(params: {
    email: string;
    token: string;
    newPassword: string;
  }): Promise<Result<void, ResetPasswordError>> {
    const publicClient = getSupabasePublicClient();
    const { data, error } = await publicClient.auth.verifyOtp({
      email: params.email,
      token: params.token,
      type: "recovery",
    });

    if (error || !data.user) {
      if (error && error.code !== "otp_expired" && !isSessionInvalidStatus(error.status)) {
        return err({ type: "UNEXPECTED", cause: error });
      }
      return err({ type: "INVALID_OR_EXPIRED_TOKEN" });
    }

    return this.updatePassword(data.user.id, params.newPassword);
  }

  /**
   * STORY-002-004 — `POST /auth/change-password`. The write-only half of
   * setting a password by user id, shared by `resetPassword` above and by
   * ChangePasswordUseCase (which verifies the current password itself, via
   * AuthSessionProvider, before calling this).
   */
  async updatePassword(
    userId: string,
    newPassword: string,
  ): Promise<Result<void, PasswordRecoveryError>> {
    const adminClient = getSupabaseAdminClient();
    const { error } = await adminClient.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      return err({ type: "UNEXPECTED", cause: error });
    }

    return ok(undefined);
  }

  private performSignIn(email: string, password: string) {
    const publicClient = getSupabasePublicClient();
    return publicClient.auth.signInWithPassword({ email, password });
  }
}
