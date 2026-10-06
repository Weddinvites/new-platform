const BEARER_PREFIX = /^Bearer\s+/i;

/**
 * Parses the `Authorization: Bearer <token>` header (API_SPEC.md § "Headers"
 * — "Authenticated requests"), used by the Session Management endpoints
 * that authenticate via a caller-held access token rather than a request
 * body (`GET /auth/me`, `POST /auth/logout`).
 */
export function extractBearerToken(header: string | null | undefined): string | null {
  if (!header || !BEARER_PREFIX.test(header)) {
    return null;
  }

  const token = header.replace(BEARER_PREFIX, "").trim();
  return token.length > 0 ? token : null;
}
