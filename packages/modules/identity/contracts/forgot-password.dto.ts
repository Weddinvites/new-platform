/**
 * Public wire contract for POST /auth/forgot-password, matching
 * API_SPEC.md §21a. Success has no `data` field — just `{ "success": true }`.
 */
export type ForgotPasswordRequestDto = {
  email: string;
};
