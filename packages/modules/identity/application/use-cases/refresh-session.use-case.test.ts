import { err, ok, type Result } from "@allinvites/kernel";
import { beforeEach, describe, expect, it } from "vitest";
import type { CreatedAuthUser } from "../ports/auth-provider.ts";
import type { SessionError, SessionProvider, VerifiedIdentity } from "../ports/session-provider.ts";
import { RefreshSessionUseCase } from "./refresh-session.use-case.ts";

class FakeSessionProvider implements SessionProvider {
  result: Result<CreatedAuthUser, SessionError> = ok({
    id: "11111111-1111-1111-1111-111111111111",
    session: { accessToken: "new-access-token", refreshToken: "new-refresh-token" },
  });
  calls: string[] = [];

  async getUserFromAccessToken(): Promise<Result<VerifiedIdentity, SessionError>> {
    throw new Error("not used by RefreshSessionUseCase tests");
  }

  async refresh(refreshToken: string): Promise<Result<CreatedAuthUser, SessionError>> {
    this.calls.push(refreshToken);
    return this.result;
  }

  async revoke(): Promise<Result<void, SessionError>> {
    throw new Error("not used by RefreshSessionUseCase tests");
  }
}

describe("RefreshSessionUseCase", () => {
  let sessionProvider: FakeSessionProvider;
  let useCase: RefreshSessionUseCase;

  beforeEach(() => {
    sessionProvider = new FakeSessionProvider();
    useCase = new RefreshSessionUseCase(sessionProvider);
  });

  it("returns a new session for a valid refresh token", async () => {
    const result = await useCase.execute({ refreshToken: "a-valid-refresh-token" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.session.accessToken).toBe("new-access-token");
    expect(result.value.session.refreshToken).toBe("new-refresh-token");
    expect(sessionProvider.calls).toEqual(["a-valid-refresh-token"]);
  });

  it("returns UNAUTHORIZED for an invalid refresh token", async () => {
    sessionProvider.result = err({ type: "UNAUTHORIZED" });

    const result = await useCase.execute({ refreshToken: "not-a-real-token" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "UNAUTHORIZED" });
  });

  it("returns UNAUTHORIZED for an expired refresh token", async () => {
    sessionProvider.result = err({ type: "UNAUTHORIZED" });

    const result = await useCase.execute({ refreshToken: "an-expired-token" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "UNAUTHORIZED" });
  });

  it("propagates an unexpected provider failure without leaking it as UNAUTHORIZED", async () => {
    sessionProvider.result = err({ type: "UNEXPECTED", cause: new Error("network down") });

    const result = await useCase.execute({ refreshToken: "a-token" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });
});
