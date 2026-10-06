import type { ResolveCurrentUserResult } from "../application/use-cases/resolve-current-user.use-case";
import type { MeResponseDto } from "../contracts/me.dto";

export function toMeResponseDto(result: ResolveCurrentUserResult): MeResponseDto {
  return {
    id: result.user.id,
    email: result.user.email.value,
    full_name: result.user.fullName.value,
    memberships: result.memberships.map((membership) => ({
      organization_id: membership.organizationId,
      role: membership.role,
    })),
  };
}
