/**
 * Public wire contract for POST /auth/profile (API_SPEC.md §23 "Update
 * User", MVP contract finalized alongside this Story). Only `full_name` is
 * writable — email and every other profile attribute are out of scope.
 */
export type UpdateProfileRequestDto = {
  full_name: string;
};

export type UpdateProfileResponseDto = {
  id: string;
  email: string;
  full_name: string;
};
