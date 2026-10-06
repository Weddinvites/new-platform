/**
 * Public wire contract for PATCH /api/v1/management/users/{userId}
 * (STORY-002-007 approved contract). Only `full_name` is editable — same
 * boundary as STORY-002-005's self-service `POST /auth/profile`.
 */
export type UpdateUserRequestDto = {
  full_name: string;
};
