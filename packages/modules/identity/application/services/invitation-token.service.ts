import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32;

/**
 * STORY-002-007 — Invite User. Generates an opaque, cryptographically
 * random invitation token and its SHA-256 hash. Only the hash is ever
 * persisted (`InvitationRepository`); the raw token exists only for the
 * duration of a single Invite User call, to be handed to
 * `InvitationDeliveryProvider` — it is never logged, never returned in an
 * API response, and never stored. Uses `node:crypto` directly (no
 * third-party dependency, no Supabase/Next.js coupling), consistent with
 * keeping the application layer framework-free.
 */
export function generateInvitationToken(): { token: string; tokenHash: string } {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return { token, tokenHash: hashInvitationToken(token) };
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
