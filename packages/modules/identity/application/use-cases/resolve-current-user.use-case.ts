import { err, ok, type Result } from "@allinvites/kernel";
import type { OrganizationMembership } from "../../domain/entities/organization-membership";
import type { User } from "../../domain/entities/user";
import type { UserRepository } from "../../domain/repositories/user-repository";
import type { SessionProvider } from "../ports/session-provider";

export type ResolveCurrentUserError =
  | { readonly type: "UNAUTHORIZED" }
  | { readonly type: "UNEXPECTED"; readonly cause: unknown };

export type ResolveCurrentUserResult = {
  readonly user: User;
  readonly memberships: OrganizationMembership[];
};

/**
 * STORY-002-003 — `GET /auth/me`. Verifies the access token, then resolves
 * the caller's own profile and Organization Memberships from the Identity
 * module's own data. Supabase is only the session/identity verifier here —
 * never the source of profile truth (MASTER_SPEC §28.1): full_name and the
 * memberships/roles all come from this module's own repository.
 */
export class ResolveCurrentUserUseCase {
  constructor(
    private readonly sessionProvider: SessionProvider,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(
    accessToken: string,
  ): Promise<Result<ResolveCurrentUserResult, ResolveCurrentUserError>> {
    const identity = await this.sessionProvider.getUserFromAccessToken(accessToken);

    if (!identity.ok) {
      if (identity.error.type === "UNAUTHORIZED") {
        return err({ type: "UNAUTHORIZED" });
      }
      return err({ type: "UNEXPECTED", cause: identity.error.cause });
    }

    const user = await this.userRepository.findById(identity.value.id);
    if (!user) {
      // Supabase confirms the token is valid, but there is no matching
      // Identity profile row — a data-consistency bug, not a client
      // authentication failure, so this must not be reported as
      // UNAUTHORIZED (that would misleadingly suggest the caller's token
      // is at fault).
      return err({
        type: "UNEXPECTED",
        cause: new Error(`No User profile found for authenticated id ${identity.value.id}.`),
      });
    }

    const memberships = await this.userRepository.findMembershipsByUserId(user.id);

    return ok({ user, memberships });
  }
}
