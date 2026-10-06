import { err, ok, type Result } from "@allinvites/kernel";
import type { OrganizationMembership } from "../../domain/entities/organization-membership";
import { CannotDemoteLastOwnerError } from "../../domain/exceptions/cannot-demote-last-owner.error";
import type { OrganizationMembershipRepository } from "../../domain/repositories/organization-membership-repository";
import type { AssignUserRoleCommand } from "../commands/assign-user-role.command";
import type { AuthorizationPolicy } from "../policies/authorization-policy";
import { TeamManagementPermissions } from "../policies/team-management-permissions";
import type { SessionProvider } from "../ports/session-provider";
import {
  type ResolveAuthorizedCallerError,
  resolveAuthorizedCaller,
} from "./resolve-authorized-caller";

export type AssignUserRoleError =
  | ResolveAuthorizedCallerError
  | { readonly type: "NOT_FOUND" }
  | CannotDemoteLastOwnerError;

export type AssignUserRoleResult = { readonly membership: OrganizationMembership };

/**
 * STORY-002-007 — `POST /api/v1/management/users/{userId}/role`. OWNER-only
 * (via `users:assign_role`). Enforces only the approved last-owner
 * invariant (mission Section 3) — no other role-hierarchy rule (e.g.
 * restricting which role a caller may grant) was approved, so none is
 * implemented here.
 */
export class AssignUserRoleUseCase {
  constructor(
    private readonly sessionProvider: SessionProvider,
    private readonly membershipRepository: OrganizationMembershipRepository,
    private readonly authorizationPolicy: AuthorizationPolicy,
  ) {}

  async execute(
    accessToken: string,
    command: AssignUserRoleCommand,
  ): Promise<Result<AssignUserRoleResult, AssignUserRoleError>> {
    const caller = await resolveAuthorizedCaller({
      sessionProvider: this.sessionProvider,
      membershipRepository: this.membershipRepository,
      authorizationPolicy: this.authorizationPolicy,
      accessToken,
      organizationId: command.organizationId,
      permission: TeamManagementPermissions.ASSIGN_USER_ROLE,
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

    const isDemotingOwner =
      target.membership.role === "OWNER" &&
      command.role !== "OWNER" &&
      target.membership.status === "ACTIVE";

    if (isDemotingOwner) {
      const activeOwners = await this.membershipRepository.countActiveOwners(
        command.organizationId,
      );
      if (activeOwners <= 1) {
        return err(new CannotDemoteLastOwnerError());
      }
    }

    const membership = await this.membershipRepository.updateRole(
      target.membership.id,
      command.role,
    );

    return ok({ membership });
  }
}
