/**
 * Public wire contract for POST /auth/refresh, matching API_SPEC.md §21a.
 * Uses the same nested `session` shape already established for Login's
 * response (a documented, non-blocking ambiguity — see README.md).
 */
export type RefreshSessionRequestDto = {
  refresh_token: string;
};

export type RefreshSessionResponseDto = {
  session: {
    access_token: string;
    refresh_token: string;
  };
};
