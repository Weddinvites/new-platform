import { err, ok, type Result } from "@allinvites/kernel";
import { Invitation } from "../../domain/entities/invitation";
import { type UserInvitedEvent, userInvitedEvent } from "../../domain/events/user-invited.event";
import { InvalidEmailError } from "../../domain/exceptions/invalid-email.error";
import { InvitationAlreadyPendingError } from "../../domain/exceptions/invitation-already-pending.error";
import type { InvitationRepository } from "../../domain/repositories/invitation-repository";
import type { OrganizationMembershipRepository } from "../../domain/repositories/organization-membership-repository";
import { Email } from "../../domain/value-objects/email";
import type { InviteUserCommand } from "../commands/invite-user.command";
import type { AuthorizationPolicy } from "../policies/authorization-policy";
import { TeamManagementPermissions } from "../policies/team-management-permissions";
import type { InvitationDeliveryProvider } from "../ports/invitation-delivery-provider";
import type { SessionProvider } from "../ports/session-provider";
import { generateInvitationToken } from "../services/invitation-token.service";
import {
  type ResolveAuthorizedCallerError,
  resolveAuthorizedCaller,
} from "./resolve-authorized-caller";

export type InviteUserError =
  | ResolveAuthorizedCallerError
  | InvalidEmailError
  | InvitationAlreadyPendingError;

export type InviteUserResult = {
  readonly invitation: Invitation;
  readonly event: UserInvitedEvent;
};

/**
 * STORY-002-007 — `POST /api/v1/management/users/invitations`. OWNER-only
 * (via `users:invite`). Generates an opaque token, persists only its hash,
 * and hands the raw token to `InvitationDeliveryProvider` — never returns
 * or logs it (mission Section 6/8).
 */
export class InviteUserUseCase {
  constructor(
    private readonly sessionProvider: SessionProvider,
    private readonly membershipRepository: OrganizationMembershipRepository,
    private readonly authorizationPolicy: AuthorizationPolicy,
    private readonly invitationRepository: InvitationRepository,
    private readonly invitationDeliveryProvider: InvitationDeliveryProvider,
  ) {}

  async execute(
    accessToken: string,
    command: InviteUserCommand,
  ): Promise<Result<InviteUserResult, InviteUserError>> {
    const caller = await resolveAuthorizedCaller({
      sessionProvider: this.sessionProvider,
      membershipRepository: this.membershipRepository,
      authorizationPolicy: this.authorizationPolicy,
      accessToken,
      organizationId: command.organizationId,
      permission: TeamManagementPermissions.INVITE_USER,
    });

    if (!caller.ok) {
      return err(caller.error);
    }

    let email: Email;
    try {
      email = Email.create(command.email);
    } catch (error) {
      if (error instanceof InvalidEmailError) {
        return err(error);
      }
      throw error;
    }

    const existingPending = await this.invitationRepository.findActivePendingByOrganizationAndEmail(
      command.organizationId,
      email,
    );

    if (existingPending?.isActivePending()) {
      return err(new InvitationAlreadyPendingError());
    }

    const { token, tokenHash } = generateInvitationToken();

    const invitation = Invitation.create({
      id: crypto.randomUUID(),
      organizationId: command.organizationId,
      email,
      role: command.role,
      tokenHash,
      invitedBy: caller.value.userId,
    });

    await this.invitationRepository.save(invitation);

    await this.invitationDeliveryProvider.deliver({
      email: email.value,
      organizationId: command.organizationId,
      role: command.role,
      token,
      expiresAt: invitation.expiresAt,
    });

    return ok({
      invitation,
      event: userInvitedEvent({
        invitationId: invitation.id,
        organizationId: command.organizationId,
        email: email.value,
        role: command.role,
        invitedBy: caller.value.userId,
      }),
    });
  }
}
