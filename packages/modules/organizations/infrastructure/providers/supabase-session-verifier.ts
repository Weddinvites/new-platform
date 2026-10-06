import { getSupabasePublicClient } from "@allinvites/auth";
import { err, ok, type Result } from "@allinvites/kernel";
import type {
  SessionVerifier,
  SessionVerifierError,
  VerifiedCaller,
} from "../../application/ports/session-verifier";

/**
 * Verifies the access token against Supabase's Auth server (not just
 * decoding the JWT locally), matching the same verification approach as
 * Identity's own SessionProvider.getUserFromAccessToken.
 */
export class SupabaseSessionVerifier implements SessionVerifier {
  async verify(accessToken: string): Promise<Result<VerifiedCaller, SessionVerifierError>> {
    const publicClient = getSupabasePublicClient();
    const { data, error } = await publicClient.auth.getUser(accessToken);

    if (error || !data.user) {
      if (error && error.status !== 401) {
        return err({ type: "UNEXPECTED", cause: error });
      }
      return err({ type: "UNAUTHORIZED" });
    }

    return ok({ userId: data.user.id });
  }
}
