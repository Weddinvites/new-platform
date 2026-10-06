import type { RefreshSessionResult } from "../application/use-cases/refresh-session.use-case";
import type { RefreshSessionResponseDto } from "../contracts/refresh-session.dto";

export function toRefreshSessionResponseDto(
  result: RefreshSessionResult,
): RefreshSessionResponseDto {
  return {
    session: {
      access_token: result.session.accessToken,
      refresh_token: result.session.refreshToken,
    },
  };
}
