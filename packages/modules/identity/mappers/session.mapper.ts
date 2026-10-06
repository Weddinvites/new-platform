import type { LoginUserResult } from "../application/use-cases/login-user.use-case";
import type { LoginResponseDto } from "../contracts/login-user.dto";

export function toLoginResponseDto(result: LoginUserResult): LoginResponseDto {
  return {
    session: {
      access_token: result.session.accessToken,
      refresh_token: result.session.refreshToken,
    },
  };
}
