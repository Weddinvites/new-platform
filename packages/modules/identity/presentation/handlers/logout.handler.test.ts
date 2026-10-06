import { ok, type Result } from "@allinvites/kernel";
import { beforeEach, describe, expect, it } from "vitest";
import type { CreatedAuthUser } from "../../application/ports/auth-provider.ts";
import type {
  SessionError,
  SessionProvider,
  VerifiedIdentity,
} from "../../application/ports/session-provider.ts";
import { LogoutUseCase } from "../../application/use-cases/logout.use-case.ts";
import { createLogoutHandler } from "./logout.handler.ts";

const USER_ID = "11111111-1111-1111-1111-111111111111";

class FakeSessionProvider implements SessionProvider {
  identityResult: Result<VerifiedIdentity, SessionError> = ok({ id: USER_ID });
  revokeResult: Result<void, SessionError> = ok(undefined);

  async getUserFromAccessToken(): Promise<Result<VerifiedIdentity, SessionError>> {
    return this.identityResult;
  }

  async refresh(): Promise<Result<CreatedAuthUser, SessionError>> {
    throw new Error("not used");
  }

  async revoke(): Promise<Result<void, SessionError>> {
    return this.revokeResult;
  }
}

describe("logoutHandler", () => {
  let handler: ReturnType<typeof createLogoutHandler>;
  let sessionProvider: FakeSessionProvider;

  beforeEach(() => {
    sessionProvider = new FakeSessionProvider();
    const useCase = new LogoutUseCase(sessionProvider);
    handler = createLogoutHandler(useCase);
  });

  it("returns 200 { success: true } for a valid session", async () => {
    const response = await handler("Bearer a-valid-access-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
  });

  it("returns 401 UNAUTHORIZED when no Authorization header is present", async () => {
    const response = await handler(null);

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication is required." },
    });
  });

  it("returns 401 UNAUTHORIZED for an already invalid/expired session", async () => {
    sessionProvider.identityResult = { ok: false, error: { type: "UNAUTHORIZED" } };

    const response = await handler("Bearer an-expired-token");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "UNAUTHORIZED" },
    });
  });

  it("returns 500 without leaking provider details on an unexpected failure", async () => {
    sessionProvider.revokeResult = {
      ok: false,
      error: { type: "UNEXPECTED", cause: new Error("db is down") },
    };

    const response = await handler("Bearer a-valid-access-token");

    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain("db is down");
  });
});
