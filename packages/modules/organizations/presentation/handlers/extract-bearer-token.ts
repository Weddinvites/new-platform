const BEARER_PREFIX = /^Bearer\s+/i;

/**
 * Parses the `Authorization: Bearer <token>` header. Mirrors Identity's
 * identically-named helper — generic HTTP-header parsing, not an
 * Identity-owned business concern, so Organizations owns its own copy rather
 * than importing Identity's internal presentation layer (ADR-011).
 */
export function extractBearerToken(header: string | null | undefined): string | null {
  if (!header || !BEARER_PREFIX.test(header)) {
    return null;
  }

  const token = header.replace(BEARER_PREFIX, "").trim();
  return token.length > 0 ? token : null;
}
