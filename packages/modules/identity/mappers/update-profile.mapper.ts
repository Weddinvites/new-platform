import type { UpdateUserProfileResult } from "../application/use-cases/update-user-profile.use-case";
import type { UpdateProfileResponseDto } from "../contracts/update-profile.dto";

export function toUpdateProfileResponseDto(
  result: UpdateUserProfileResult,
): UpdateProfileResponseDto {
  return {
    id: result.user.id,
    email: result.user.email.value,
    full_name: result.user.fullName.value,
  };
}
