import { ok, type Result } from "@allinvites/kernel";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  PasswordRecoveryError,
  PasswordRecoveryProvider,
  ResetPasswordError,
} from "../../application/ports/password-recovery-provider.ts";
import { ResetPasswordUseCase } from "../../application/use-cases/reset-password.use-case.ts";
import { createResetPasswordHandler } from "./reset-password.handler.ts";

class FakePasswordRecoveryProvider implements PasswordRecoveryProvider {
  result: Result<void, ResetPasswordError> = ok(undefined);

  async initiateRecovery(): Promise<Result<void, PasswordRecoveryError>> {
    throw new Error("not used");
  }

  async resetPassword(): Promise<Result<void, ResetPasswordError>> {
    return this.result;
  }

  async updatePassword(): Promise<Result<void, PasswordRecoveryError>> {
    throw new Error("not used");
  }
}

describe("resetPasswordHandler", () => {
  let handler: ReturnType<typeof createResetPasswordHandler>;
  let provider: FakePasswordRecoveryProvider;

  beforeEach(() => {
    provider = new FakePasswordRecoveryProvider();
    const useCase = new ResetPasswordUseCase(provider);
    handler = createResetPasswordHandler(useCase);
  });

  it("returns 200 { success: true } on a successful reset", async () => {
    const response = await handler({
      email: "user@example.com",
      token: "a-valid-recovery-token",
      password: "a-valid-password",
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
  });

  it("returns 422 VALIDATION_ERROR for a malformed body", async () => {
    const response = await handler({ email: "user@example.com" });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("returns 400 for a password outside the 8-72 character policy", async () => {
    const response = await handler({
      email: "user@example.com",
      token: "a-valid-recovery-token",
      password: "short",
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ success: false, error: { code: "INVALID_PASSWORD" } });
  });

  it("returns 400 INVALID_OR_EXPIRED_TOKEN for an invalid or expired token", async () => {
    provider.result = { ok: false, error: { type: "INVALID_OR_EXPIRED_TOKEN" } };

    const response = await handler({
      email: "user@example.com",
      token: "not-a-real-token",
      password: "a-valid-password",
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "INVALID_OR_EXPIRED_TOKEN" },
    });
  });

  it("returns 500 without leaking provider details on an unexpected failure", async () => {
    provider.result = { ok: false, error: { type: "UNEXPECTED", cause: new Error("db is down") } };

    const response = await handler({
      email: "user@example.com",
      token: "a-token",
      password: "a-valid-password",
    });

    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain("db is down");
  });

  it("never includes the password or token in a response body", async () => {
    provider.result = { ok: false, error: { type: "INVALID_OR_EXPIRED_TOKEN" } };

    const response = await handler({
      email: "user@example.com",
      token: "super-secret-recovery-token",
      password: "super-secret-new-password",
    });

    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain("super-secret-recovery-token");
    expect(serialized).not.toContain("super-secret-new-password");
  });
});
