/**
 * Public wire contract for POST /auth/register, matching API_SPEC.md §21a
 * exactly (snake_case field names, matching the documented JSON schema).
 */
export type RegisterUserRequestDto = {
  email: string;
  password: string;
  full_name: string;
  invitation_token?: string;
};

export type RegisteredUserDto = {
  id: string;
  email: string;
  full_name: string;
  email_verified: boolean;
  memberships: Array<{
    organization_id: string;
    role: string;
  }>;
  session: {
    access_token: string;
    refresh_token: string;
  };
};
