import { err, ok, type Result } from "@allinvites/kernel";
import type { User } from "../../domain/entities/user";
import { InvalidFullNameError } from "../../domain/exceptions/invalid-full-name.error";
import type { OrganizationMembershipRepository } from "../../domain/repositories/organization-membership-repository";
import type { UserRepository } from "../../domain/repositories/user-repository";
import { FullName } from "../../domain/value-objects/full-name";
import type { UpdateUserCommand } from "../commands/update-user.command";
import type { AuthorizationPolicy } from "../policies/authorization-policy";
import { TeamManagementPermissions } from "../policies/team-management-permissions";
import type { SessionProvider } from "../ports/session-provider";
import {
  type ResolveAuthorizedCallerError,
  resolveAuthorizedCaller,
} from "./resolve-authorized-caller";

export type UpdateUserError =
  | ResolveAuthorizedCallerError
  | { readonly type: "NOT_FOUND" }
  | InvalidFullNameError;

export type UpdateUserResult = { readonly user: User };

/**
 * STORY-002-007 — `PATCH /api/v1/management/users/{userId}`. OWNER-only
 * (via `users:update`). Admin-side equivalent of STORY-002-005's
 * self-service `POST /auth/profile`; scoped to `full_name` only, per the
 * approved contract — no other profile field is editable here either.
 */
export class UpdateUserUseCase {
  constructor(
    private readonly sessionProvider: SessionProvider,
    private readonly membershipRepository: OrganizationMembershipRepository,
    private readonly authorizationPolicy: AuthorizationPolicy,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(
    accessToken: string,
    command: UpdateUserCommand,
  ): Promise<Result<UpdateUserResult, UpdateUserError>> {
    const caller = await resolveAuthorizedCaller({
      sessionProvider: this.sessionProvider,
      membershipRepository: this.membershipRepository,
      authorizationPolicy: this.authorizationPolicy,
      accessToken,
      organizationId: command.organizationId,
      permission: TeamManagementPermissions.UPDATE_USER,
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

    let fullName: FullName;
    try {
      fullName = FullName.create(command.fullName);
    } catch (error) {
      if (error instanceof InvalidFullNameError) {
        return err(error);
      }
      throw error;
    }

    const updatedUser = await this.userRepository.updateFullName(command.targetUserId, fullName);

    return ok({ user: updatedUser });
  }
}
