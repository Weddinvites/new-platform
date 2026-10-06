import { err, ok, type Result } from "@allinvites/kernel";
import type { RefreshSessionCommand } from "../commands/refresh-session.command";
import type { AuthSession } from "../ports/auth-provider";
import type { SessionProvider } from "../ports/session-provider";

export type RefreshSessionError =
  | { readonly type: "UNAUTHORIZED" }
  | { readonly type: "UNEXPECTED"; readonly cause: unknown };

export type RefreshSessionResult = {
  readonly session: AuthSession;
};

/**
 * STORY-002-003 — `POST /auth/refresh`. Exchanges a refresh token for a new
 * session via the same SessionProvider used by `GET /auth/me` and
 * `POST /auth/logout`, matching API_SPEC.md §21a's documented
 * `UNAUTHORIZED (invalid or expired refresh token)` error.
 */
export class RefreshSessionUseCase {
  constructor(private readonly sessionProvider: SessionProvider) {}

  async execute(
    command: RefreshSessionCommand,
  ): Promise<Result<RefreshSessionResult, RefreshSessionError>> {
    const result = await this.sessionProvider.refresh(command.refreshToken);

    if (!result.ok) {
      if (result.error.type === "UNAUTHORIZED") {
        return err({ type: "UNAUTHORIZED" });
      }
      return err({ type: "UNEXPECTED", cause: result.error.cause });
    }

    return ok({ session: result.value.session });
  }
}
