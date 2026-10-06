import { err, ok, type Result } from "@allinvites/kernel";
import { type UserRemovedEvent, userRemovedEvent } from "../../domain/events/user-removed.event";
import { CannotRemoveLastOwnerError } from "../../domain/exceptions/cannot-remove-last-owner.error";
import type { OrganizationMembershipRepository } from "../../domain/repositories/organization-membership-repository";
import type { RemoveUserCommand } from "../commands/remove-user.command";
import type { AuthorizationPolicy } from "../policies/authorization-policy";
import { TeamManagementPermissions } from "../policies/team-management-permissions";
import type { SessionProvider } from "../ports/session-provider";
import {
  type ResolveAuthorizedCallerError,
  resolveAuthorizedCaller,
} from "./resolve-authorized-caller";

export type RemoveUserError =
  | ResolveAuthorizedCallerError
  | { readonly type: "NOT_FOUND" }
  | CannotRemoveLastOwnerError;

export type RemoveUserResult = { readonly event: UserRemovedEvent };

/**
 * STORY-002-007 — `DELETE /api/v1/management/users/{userId}`. OWNER-only
 * (via `users:remove`). Transitions the target's Organization Membership to
 * REMOVED (soft — never a physical row delete, so historical records remain
 * intact per API_SPEC.md §23). Never touches the global User/auth account or
 * any other organization's membership.
 */
export class RemoveUserUseCase {
  constructor(
    private readonly sessionProvider: SessionProvider,
    private readonly membershipRepository: OrganizationMembershipRepository,
    private readonly authorizationPolicy: AuthorizationPolicy,
  ) {}

  async execute(
    accessToken: string,
    command: RemoveUserCommand,
  ): Promise<Result<RemoveUserResult, RemoveUserError>> {
    const caller = await resolveAuthorizedCaller({
      sessionProvider: this.sessionProvider,
      membershipRepository: this.membershipRepository,
      authorizationPolicy: this.authorizationPolicy,
      accessToken,
      organizationId: command.organizationId,
      permission: TeamManagementPermissions.REMOVE_USER,
    });

    if (!caller.ok) {
      return err(caller.error);
    }

    const target = await this.membershipRepository.findMemberWithUser(
      command.targetUserId,
      command.organizationId,
    );

    if (!target) {
      return err({ type: "NOT_FOUND" });
    }

    if (target.membership.role === "OWNER" && target.membership.status === "ACTIVE") {
      const activeOwners = await this.membershipRepository.countActiveOwners(
        command.organizationId,
      );
      if (activeOwners <= 1) {
        return err(new CannotRemoveLastOwnerError());
      }
    }

    await this.membershipRepository.updateStatus(target.membership.id, "REMOVED");

    return ok({
      event: userRemovedEvent({
        userId: command.targetUserId,
        organizationId: command.organizationId,
        removedBy: caller.value.userId,
      }),
    });
  }
}
