import { ok, type Result } from "@allinvites/kernel";
import { beforeEach, describe, expect, it } from "vitest";
import type { CreatedAuthUser } from "../../application/ports/auth-provider.ts";
import type {
  SessionError,
  SessionProvider,
  VerifiedIdentity,
} from "../../application/ports/session-provider.ts";
import { RefreshSessionUseCase } from "../../application/use-cases/refresh-session.use-case.ts";
import { createRefreshSessionHandler } from "./refresh-session.handler.ts";

class FakeSessionProvider implements SessionProvider {
  result: Result<CreatedAuthUser, SessionError> = ok({
    id: "11111111-1111-1111-1111-111111111111",
    session: { accessToken: "new-access-token", refreshToken: "new-refresh-token" },
  });

  async getUserFromAccessToken(): Promise<Result<VerifiedIdentity, SessionError>> {
    throw new Error("not used");
  }

  async refresh(): Promise<Result<CreatedAuthUser, SessionError>> {
    return this.result;
  }

  async revoke(): Promise<Result<void, SessionError>> {
    throw new Error("not used");
  }
}

describe("refreshSessionHandler", () => {
  let handler: ReturnType<typeof createRefreshSessionHandler>;
  let sessionProvider: FakeSessionProvider;

  beforeEach(() => {
    sessionProvider = new FakeSessionProvider();
    const useCase = new RefreshSessionUseCase(sessionProvider);
    handler = createRefreshSessionHandler(useCase);
  });

  it("returns 200 with a new session for a valid refresh token", async () => {
    const response = await handler({ refresh_token: "a-valid-refresh-token" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: { session: { access_token: "new-access-token", refresh_token: "new-refresh-token" } },
    });
  });

  it("returns 422 VALIDATION_ERROR for a malformed body", async () => {
    const response = await handler({});

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("returns 401 UNAUTHORIZED for an invalid or expired refresh token", async () => {
    sessionProvider.result = { ok: false, error: { type: "UNAUTHORIZED" } };

    const response = await handler({ refresh_token: "an-invalid-token" });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "UNAUTHORIZED" },
    });
  });

  it("returns 500 without leaking provider details on an unexpected failure", async () => {
    sessionProvider.result = {
      ok: false,
      error: { type: "UNEXPECTED", cause: new Error("db is down") },
    };

    const response = await handler({ refresh_token: "a-token" });

    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain("db is down");
  });

  it("never includes tokens from the request in an error response", async () => {
    sessionProvider.result = { ok: false, error: { type: "UNAUTHORIZED" } };

    const response = await handler({ refresh_token: "super-secret-refresh-token" });

    expect(JSON.stringify(response.body)).not.toContain("super-secret-refresh-token");
  });
});
