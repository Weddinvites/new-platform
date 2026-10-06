import { err, ok, type Result } from "@allinvites/kernel";
import type {
  MembershipWithUser,
  OrganizationMembershipRepository,
} from "../../domain/repositories/organization-membership-repository";
import type { GetUserCommand } from "../commands/get-user.command";
import type { AuthorizationPolicy } from "../policies/authorization-policy";
import { TeamManagementPermissions } from "../policies/team-management-permissions";
import type { SessionProvider } from "../ports/session-provider";
import {
  type ResolveAuthorizedCallerError,
  resolveAuthorizedCaller,
} from "./resolve-authorized-caller";

export type GetUserError = ResolveAuthorizedCallerError | { readonly type: "NOT_FOUND" };

export type GetUserResult = MembershipWithUser;

/**
 * STORY-002-007 — `GET /api/v1/management/users/{userId}`. OWNER-only (via
 * `users:read`). `NOT_FOUND` covers both "no such user" and "user belongs to
 * a different organization" identically, so a caller can never distinguish
 * a cross-organization user from a nonexistent one.
 */
export class GetUserUseCase {
  constructor(
    private readonly sessionProvider: SessionProvider,
    private readonly membershipRepository: OrganizationMembershipRepository,
    private readonly authorizationPolicy: AuthorizationPolicy,
  ) {}

  async execute(
    accessToken: string,
    command: GetUserCommand,
  ): Promise<Result<GetUserResult, GetUserError>> {
    const caller = await resolveAuthorizedCaller({
      sessionProvider: this.sessionProvider,
      membershipRepository: this.membershipRepository,
      authorizationPolicy: this.authorizationPolicy,
      accessToken,
      organizationId: command.organizationId,
      permission: TeamManagementPermissions.READ_USER,
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

    return ok(target);
  }
}
