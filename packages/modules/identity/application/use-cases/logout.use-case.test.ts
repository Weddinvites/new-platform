import { err, ok, type Result } from "@allinvites/kernel";
import { beforeEach, describe, expect, it } from "vitest";
import type { CreatedAuthUser } from "../ports/auth-provider.ts";
import type { SessionError, SessionProvider, VerifiedIdentity } from "../ports/session-provider.ts";
import { LogoutUseCase } from "./logout.use-case.ts";

const USER_ID = "11111111-1111-1111-1111-111111111111";

class FakeSessionProvider implements SessionProvider {
  identityResult: Result<VerifiedIdentity, SessionError> = ok({ id: USER_ID });
  revokeResult: Result<void, SessionError> = ok(undefined);
  revokeCalls: string[] = [];

  async getUserFromAccessToken(): Promise<Result<VerifiedIdentity, SessionError>> {
    return this.identityResult;
  }

  async refresh(): Promise<Result<CreatedAuthUser, SessionError>> {
    throw new Error("not used by LogoutUseCase tests");
  }

  async revoke(accessToken: string): Promise<Result<void, SessionError>> {
    this.revokeCalls.push(accessToken);
    return this.revokeResult;
  }
}

describe("LogoutUseCase", () => {
  let sessionProvider: FakeSessionProvider;
  let useCase: LogoutUseCase;

  beforeEach(() => {
    sessionProvider = new FakeSessionProvider();
    useCase = new LogoutUseCase(sessionProvider);
  });

  it("revokes the session for a valid access token and returns a UserLoggedOut event", async () => {
    const result = await useCase.execute("a-valid-access-token");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({ type: "UserLoggedOut", userId: USER_ID });
    expect(sessionProvider.revokeCalls).toEqual(["a-valid-access-token"]);
  });

  it("returns UNAUTHORIZED without revoking when the access token cannot be verified", async () => {
    sessionProvider.identityResult = err({ type: "UNAUTHORIZED" });

    const result = await useCase.execute("an-expired-token");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "UNAUTHORIZED" });
    expect(sessionProvider.revokeCalls).toHaveLength(0);
  });

  it("returns UNAUTHORIZED when revocation itself fails", async () => {
    sessionProvider.revokeResult = err({ type: "UNAUTHORIZED" });

    const result = await useCase.execute("a-token-that-fails-to-revoke");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "UNAUTHORIZED" });
  });

  it("propagates an unexpected provider failure without leaking it as UNAUTHORIZED", async () => {
    sessionProvider.revokeResult = err({ type: "UNEXPECTED", cause: new Error("network down") });

    const result = await useCase.execute("a-token");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });
});
