import { err, ok, type Result } from "@allinvites/kernel";
import type { OrganizationMembership } from "../../domain/entities/organization-membership";
import type { OrganizationMembershipRepository } from "../../domain/repositories/organization-membership-repository";
import type { ActivateUserCommand } from "../commands/activate-user.command";
import type { AuthorizationPolicy } from "../policies/authorization-policy";
import { TeamManagementPermissions } from "../policies/team-management-permissions";
import type { SessionProvider } from "../ports/session-provider";
import {
  type ResolveAuthorizedCallerError,
  resolveAuthorizedCaller,
} from "./resolve-authorized-caller";

export type ActivateUserError = ResolveAuthorizedCallerError | { readonly type: "NOT_FOUND" };

export type ActivateUserResult = { readonly membership: OrganizationMembership };

/**
 * STORY-002-007 — `POST /api/v1/management/users/{userId}/activate`.
 * OWNER-only (via `users:suspend` — shared with Suspend User, see that use
 * case's comment). SUSPENDED -> ACTIVE only. No last-owner invariant:
 * reactivating a membership never reduces the active-owner count.
 */
export class ActivateUserUseCase {
  constructor(
    private readonly sessionProvider: SessionProvider,
    private readonly membershipRepository: OrganizationMembershipRepository,
    private readonly authorizationPolicy: AuthorizationPolicy,
  ) {}

  async execute(
    accessToken: string,
    command: ActivateUserCommand,
  ): Promise<Result<ActivateUserResult, ActivateUserError>> {
    const caller = await resolveAuthorizedCaller({
      sessionProvider: this.sessionProvider,
      membershipRepository: this.membershipRepository,
      authorizationPolicy: this.authorizationPolicy,
      accessToken,
      organizationId: command.organizationId,
      permission: TeamManagementPermissions.SUSPEND_USER,
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

    const membership = await this.membershipRepository.updateStatus(target.membership.id, "ACTIVE");

    return ok({ membership });
  }
}
