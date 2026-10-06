/**
 * Public wire contract for POST /auth/change-password (API_SPEC.md §23
 * "Change Password" — technical contract finalized alongside this Story).
 * Success has no `data` field — just `{ "success": true }`.
 */
export type ChangePasswordRequestDto = {
  current_password: string;
  new_password: string;
};
