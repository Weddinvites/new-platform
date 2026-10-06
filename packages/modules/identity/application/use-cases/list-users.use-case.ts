import { err, ok, type Result } from "@allinvites/kernel";
import type {
  ListOrganizationMembersResult,
  OrganizationMembershipRepository,
} from "../../domain/repositories/organization-membership-repository";
import type { ListUsersCommand } from "../commands/list-users.command";
import type { AuthorizationPolicy } from "../policies/authorization-policy";
import { TeamManagementPermissions } from "../policies/team-management-permissions";
import type { SessionProvider } from "../ports/session-provider";
import {
  type ResolveAuthorizedCallerError,
  resolveAuthorizedCaller,
} from "./resolve-authorized-caller";

export type ListUsersError = ResolveAuthorizedCallerError;

export type ListUsersResult = ListOrganizationMembersResult;

/**
 * STORY-002-007 — `GET /api/v1/management/users`. OWNER-only (via
 * `users:list`). Returns only members of the caller's verified
 * `organizationId` — never another organization's members.
 */
export class ListUsersUseCase {
  constructor(
    private readonly sessionProvider: SessionProvider,
    private readonly membershipRepository: OrganizationMembershipRepository,
    private readonly authorizationPolicy: AuthorizationPolicy,
  ) {}

  async execute(
    accessToken: string,
    command: ListUsersCommand,
  ): Promise<Result<ListUsersResult, ListUsersError>> {
    const caller = await resolveAuthorizedCaller({
      sessionProvider: this.sessionProvider,
      membershipRepository: this.membershipRepository,
      authorizationPolicy: this.authorizationPolicy,
      accessToken,
      organizationId: command.organizationId,
      permission: TeamManagementPermissions.LIST_USERS,
    });

    if (!caller.ok) {
      return err(caller.error);
    }

    const result = await this.membershipRepository.listByOrganization(command.organizationId, {
      page: command.page,
      pageSize: command.pageSize,
    });

    return ok(result);
  }
}
