/**
 * Public wire contract for GET /auth/me, matching API_SPEC.md §21a exactly.
 * Deliberately does NOT include `email_verified` — the documented schema for
 * this endpoint omits it (unlike the registration response).
 */
export type MeResponseDto = {
  id: string;
  email: string;
  full_name: string;
  memberships: Array<{
    organization_id: string;
    role: string;
  }>;
};
