import type { InvitationDto } from "../contracts/invite-user.dto";
import type { UserMembershipDto } from "../contracts/user-membership.dto";
import type { Invitation } from "../domain/entities/invitation";
import type { MembershipWithUser } from "../domain/repositories/organization-membership-repository";

export function toInvitationDto(invitation: Invitation): InvitationDto {
  return {
    id: invitation.id,
    email: invitation.email.value,
    role: invitation.role,
    organization_id: invitation.organizationId,
    status: "PENDING",
    expires_at: invitation.expiresAt.toISOString(),
  };
}

export function toUserMembershipDto(entry: MembershipWithUser): UserMembershipDto {
  return {
    id: entry.user.id,
    email: entry.user.email.value,
    full_name: entry.user.fullName.value,
    email_verified: entry.user.emailVerified,
    organization_id: entry.membership.organizationId,
    role: entry.membership.role,
    status: entry.membership.status,
  };
}
