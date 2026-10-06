import type { RegisterUserResult } from "../application/use-cases/register-user.use-case";
import type { RegisteredUserDto } from "../contracts/register-user.dto";

export function toRegisteredUserDto(result: RegisterUserResult): RegisteredUserDto {
  return {
    id: result.user.id,
    email: result.user.email.value,
    full_name: result.user.fullName.value,
    email_verified: result.user.emailVerified,
    memberships: [
      {
        organization_id: result.membership.organizationId,
        role: result.membership.role,
      },
    ],
    session: {
      access_token: result.session.accessToken,
      refresh_token: result.session.refreshToken,
    },
  };
}
