import { err, ok, type Result } from "@allinvites/kernel";
import {
  type UserLoggedOutEvent,
  userLoggedOutEvent,
} from "../../domain/events/user-logged-out.event";
import type { SessionProvider } from "../ports/session-provider";

export type LogoutError =
  | { readonly type: "UNAUTHORIZED" }
  | { readonly type: "UNEXPECTED"; readonly cause: unknown };

/**
 * STORY-002-003 — `POST /auth/logout`. Identifies the caller (needed for the
 * UserLoggedOut event, MASTER_SPEC §28.1 "Produce"), then revokes the
 * session via SessionProvider.
 */
export class LogoutUseCase {
  constructor(private readonly sessionProvider: SessionProvider) {}

  async execute(accessToken: string): Promise<Result<UserLoggedOutEvent, LogoutError>> {
    const identity = await this.sessionProvider.getUserFromAccessToken(accessToken);

    if (!identity.ok) {
      if (identity.error.type === "UNAUTHORIZED") {
        return err({ type: "UNAUTHORIZED" });
      }
      return err({ type: "UNEXPECTED", cause: identity.error.cause });
    }

    const revoked = await this.sessionProvider.revoke(accessToken);

    if (!revoked.ok) {
      if (revoked.error.type === "UNAUTHORIZED") {
        return err({ type: "UNAUTHORIZED" });
      }
      return err({ type: "UNEXPECTED", cause: revoked.error.cause });
    }

    return ok(userLoggedOutEvent({ userId: identity.value.id }));
  }
}
