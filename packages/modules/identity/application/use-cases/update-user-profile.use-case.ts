import { err, ok, type Result } from "@allinvites/kernel";
import type { User } from "../../domain/entities/user";
import { InvalidFullNameError } from "../../domain/exceptions/invalid-full-name.error";
import type { UserRepository } from "../../domain/repositories/user-repository";
import { FullName } from "../../domain/value-objects/full-name";
import type { UpdateUserProfileCommand } from "../commands/update-user-profile.command";
import type { SessionProvider } from "../ports/session-provider";

export type UpdateUserProfileError =
  | { readonly type: "UNAUTHORIZED" }
  | InvalidFullNameError
  | { readonly type: "UNEXPECTED"; readonly cause: unknown };

export type UpdateUserProfileResult = {
  readonly user: User;
};

/**
 * STORY-002-005 — `POST /auth/profile` (MVP). Identifies the caller via the
 * existing SessionProvider (never a client-supplied id), then updates only
 * `full_name` via UserRepository. No other profile field is in scope.
 */
export class UpdateUserProfileUseCase {
  constructor(
    private readonly sessionProvider: SessionProvider,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(
    accessToken: string,
    command: UpdateUserProfileCommand,
  ): Promise<Result<UpdateUserProfileResult, UpdateUserProfileError>> {
    const identity = await this.sessionProvider.getUserFromAccessToken(accessToken);

    if (!identity.ok) {
      if (identity.error.type === "UNAUTHORIZED") {
        return err({ type: "UNAUTHORIZED" });
      }
      return err({ type: "UNEXPECTED", cause: identity.error.cause });
    }

    const existingUser = await this.userRepository.findById(identity.value.id);
    if (!existingUser) {
      // Same reasoning as ResolveCurrentUserUseCase/ChangePasswordUseCase: a
      // valid token with no matching local profile is a data-consistency
      // bug, not a caller authentication failure.
      return err({
        type: "UNEXPECTED",
        cause: new Error(`No User profile found for authenticated id ${identity.value.id}.`),
      });
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

    const updatedUser = await this.userRepository.updateFullName(existingUser.id, fullName);

    return ok({ user: updatedUser });
  }
}
