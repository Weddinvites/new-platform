import type { Result } from "@allinvites/kernel";
import type { CreatedAuthUser } from "./auth-provider";

/**
 * Technical failures for operations on an EXISTING session (STORY-002-003).
 * `UNAUTHORIZED` covers every case where the caller cannot be proven to hold
 * a currently valid session/token — matching API_SPEC.md §21a's `UNAUTHORIZED`
 * code, used identically for `GET /auth/me` and `POST /auth/refresh`.
 */
export type SessionError =
  | { readonly type: "UNAUTHORIZED" }
  | { readonly type: "UNEXPECTED"; readonly cause: unknown };

export type VerifiedIdentity = {
  readonly id: string;
};

/**
 * Port for operations on an already-established session (STORY-002-003 —
 * Session Management): verifying an access token, exchanging a refresh
 * token, and revoking a session. Deliberately separate from AuthProvider
 * (account creation, STORY-002-001) and AuthSessionProvider (establishing a
 * NEW session from credentials, STORY-002-002) — Interface Segregation, and
 * avoids touching either of those already-approved Stories' ports or fakes.
 * Implemented by SupabaseAuthProvider in the Infrastructure layer.
 */
export interface SessionProvider {
  /** Verifies an access token and returns the identity it belongs to. */
  getUserFromAccessToken(accessToken: string): Promise<Result<VerifiedIdentity, SessionError>>;

  /** Exchanges a valid refresh token for a new session. */
  refresh(refreshToken: string): Promise<Result<CreatedAuthUser, SessionError>>;

  /** Revokes the session identified by this access token. */
  revoke(accessToken: string): Promise<Result<void, SessionError>>;
}
