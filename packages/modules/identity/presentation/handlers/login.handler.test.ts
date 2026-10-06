import { ok, type Result } from "@allinvites/kernel";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  AuthSessionProvider,
  CreatedAuthUser,
  SignInError,
} from "../../application/ports/auth-provider.ts";
import { LoginUserUseCase } from "../../application/use-cases/login-user.use-case.ts";
import { createLoginHandler } from "./login.handler.ts";

class FakeAuthSessionProvider implements AuthSessionProvider {
  result: Result<CreatedAuthUser, SignInError> = ok({
    id: "11111111-1111-1111-1111-111111111111",
    session: { accessToken: "access-token", refreshToken: "refresh-token" },
  });

  async signIn(): Promise<Result<CreatedAuthUser, SignInError>> {
    return this.result;
  }
}

describe("loginHandler", () => {
  let handler: ReturnType<typeof createLoginHandler>;
  let authSessionProvider: FakeAuthSessionProvider;

  beforeEach(() => {
    authSessionProvider = new FakeAuthSessionProvider();
    const useCase = new LoginUserUseCase(authSessionProvider);
    handler = createLoginHandler(useCase);
  });

  it("returns 200 with the session on valid credentials", async () => {
    const response = await handler({ email: "user@example.com", password: "a-valid-password" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: { session: { access_token: "access-token", refresh_token: "refresh-token" } },
    });
  });

  it("returns 422 VALIDATION_ERROR for a malformed body", async () => {
    const response = await handler({ email: "user@example.com" });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("returns 401 INVALID_CREDENTIALS for wrong credentials", async () => {
    authSessionProvider.result = { ok: false, error: { type: "INVALID_CREDENTIALS" } };

    const response = await handler({ email: "user@example.com", password: "wrong-password" });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "INVALID_CREDENTIALS" },
    });
  });

  it("returns 401 INVALID_CREDENTIALS for a non-existent account, identically to a wrong password", async () => {
    authSessionProvider.result = { ok: false, error: { type: "INVALID_CREDENTIALS" } };

    const response = await handler({ email: "nobody@example.com", password: "whatever" });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." },
    });
  });

  it("returns 500 without leaking details on an unexpected failure", async () => {
    authSessionProvider.result = {
      ok: false,
      error: { type: "UNEXPECTED", cause: new Error("db is down") },
    };

    const response = await handler({ email: "user@example.com", password: "a-valid-password" });

    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain("db is down");
  });

  it("never includes the password in a response body", async () => {
    const response = await handler({
      email: "user@example.com",
      password: "super-secret-password",
    });

    expect(JSON.stringify(response.body)).not.toContain("super-secret-password");
  });
});
