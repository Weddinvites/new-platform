import { err, ok, type Result } from "@allinvites/kernel";
import type { OrganizationMembership } from "../../domain/entities/organization-membership";
import { CannotSuspendLastOwnerError } from "../../domain/exceptions/cannot-suspend-last-owner.error";
import type { OrganizationMembershipRepository } from "../../domain/repositories/organization-membership-repository";
import type { SuspendUserCommand } from "../commands/suspend-user.command";
import type { AuthorizationPolicy } from "../policies/authorization-policy";
import { TeamManagementPermissions } from "../policies/team-management-permissions";
import type { SessionProvider } from "../ports/session-provider";
import {
  type ResolveAuthorizedCallerError,
  resolveAuthorizedCaller,
} from "./resolve-authorized-caller";

export type SuspendUserError =
  | ResolveAuthorizedCallerError
  | { readonly type: "NOT_FOUND" }
  | CannotSuspendLastOwnerError;

export type SuspendUserResult = { readonly membership: OrganizationMembership };

/**
 * STORY-002-007 — `POST /api/v1/management/users/{userId}/suspend`.
 * OWNER-only (via `users:suspend` — the same permission also guards
 * Activate User; the approved 7-permission list has no separate "activate"
 * permission, since Suspend/Activate are one capability pair, mission
 * Section 2). ACTIVE -> SUSPENDED only.
 */
export class SuspendUserUseCase {
  constructor(
    private readonly sessionProvider: SessionProvider,
    private readonly membershipRepository: OrganizationMembershipRepository,
    private readonly authorizationPolicy: AuthorizationPolicy,
  ) {}

  async execute(
    accessToken: string,
    command: SuspendUserCommand,
  ): Promise<Result<SuspendUserResult, SuspendUserError>> {
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

    if (target.membership.role === "OWNER" && target.membership.status === "ACTIVE") {
      const activeOwners = await this.membershipRepository.countActiveOwners(
        command.organizationId,
      );
      if (activeOwners <= 1) {
        return err(new CannotSuspendLastOwnerError());
      }
    }

    const membership = await this.membershipRepository.updateStatus(
      target.membership.id,
      "SUSPENDED",
    );

    return ok({ membership });
  }
}
