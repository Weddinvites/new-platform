/**
 * Public wire contract for POST /auth/login, matching API_SPEC.md §21a.
 * The success response carries only the session — profile/membership
 * resolution belongs to `GET /auth/me` (STORY-002-003), not Login.
 */
export type LoginRequestDto = {
  email: string;
  password: string;
};

export type LoginResponseDto = {
  session: {
    access_token: string;
    refresh_token: string;
  };
};
