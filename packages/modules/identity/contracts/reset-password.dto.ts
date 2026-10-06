/**
 * Public wire contract for POST /auth/reset-password. API_SPEC.md §21a
 * documents the endpoint's purpose/errors but not its exact request field
 * names; `email` is included because Supabase's token-verification API
 * requires it alongside the token (see SupabaseAuthProvider.resetPassword).
 * Success has no `data` field — just `{ "success": true }`.
 */
export type ResetPasswordRequestDto = {
  email: string;
  token: string;
  password: string;
};
