import type { Result } from "@allinvites/kernel";

export type VerifiedCaller = {
  readonly userId: string;
};

export type SessionVerifierError =
  | { readonly type: "UNAUTHORIZED" }
  | { readonly type: "UNEXPECTED"; readonly cause: unknown };

/**
 * Port for verifying a caller's Bearer access token (STORY-003-001
 * authentication requirement). Session/token verification against Supabase
 * is shared platform infrastructure (`@allinvites/auth`), not an
 * Identity-domain business concern — Organizations owns its own minimal
 * adapter here rather than importing Identity's internal SessionProvider/
 * SupabaseAuthProvider, keeping Identity's public surface additions limited
 * to exactly the one approved CreateInitialOwnerMembershipService (ADR-011).
 * Implemented by SupabaseSessionVerifier in the Infrastructure layer.
 */
export interface SessionVerifier {
  verify(accessToken: string): Promise<Result<VerifiedCaller, SessionVerifierError>>;
}
