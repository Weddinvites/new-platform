import type { Result } from "@allinvites/kernel";

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
};

export type CreatedAuthUser = {
  id: string;
  /**
   * Present when the provider auto-authenticates a newly created user
   * (API_SPEC.md §21a "Registration Decisions", point 2). Registration
   * always establishes a session for MVP, so implementations are expected
   * to populate this.
   */
  session: AuthSession;
};

/**
 * Technical failures from the authentication provider (Infrastructure-layer
 * concern). The use case translates these into domain-level business
 * exceptions before returning — see Architecture.md "Error Handling".
 */
export type AuthProviderError =
  | { readonly type: "EMAIL_ALREADY_REGISTERED" }
  | { readonly type: "UNEXPECTED"; readonly cause: unknown };

/**
 * Port for the identity provider (Supabase Auth). Owns credential storage
 * and hashing — the Identity module's own repositories never see or persist
 * a password (EPIC_002_IDENTITY.md STORY-002-001 acceptance criteria).
 * Implemented by SupabaseAuthProvider in the Infrastructure layer.
 */
export interface AuthProvider {
  createUser(params: {
    email: string;
    password: string;
    fullName: string;
  }): Promise<Result<CreatedAuthUser, AuthProviderError>>;
}

/**
 * Technical failures from a sign-in attempt (STORY-002-002 — User Login).
 * `INVALID_CREDENTIALS` covers both "no such account" and "wrong password"
 * indistinguishably, per API_SPEC.md §21a: the error "does not reveal
 * whether the email exists."
 */
export type SignInError =
  | { readonly type: "INVALID_CREDENTIALS" }
  | { readonly type: "UNEXPECTED"; readonly cause: unknown };

/**
 * Separate, narrow port for authenticating an existing User (Interface
 * Segregation: Login does not need account-creation capability). Implemented
 * by the same SupabaseAuthProvider used for registration, reusing its
 * Supabase client rather than duplicating auth infrastructure.
 */
export interface AuthSessionProvider {
  signIn(params: {
    email: string;
    password: string;
  }): Promise<Result<CreatedAuthUser, SignInError>>;
}
