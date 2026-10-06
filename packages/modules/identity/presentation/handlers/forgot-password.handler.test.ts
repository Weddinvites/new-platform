import { ok, type Result } from "@allinvites/kernel";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  PasswordRecoveryError,
  PasswordRecoveryProvider,
  ResetPasswordError,
} from "../../application/ports/password-recovery-provider.ts";
import { InitiatePasswordRecoveryUseCase } from "../../application/use-cases/initiate-password-recovery.use-case.ts";
import { createForgotPasswordHandler } from "./forgot-password.handler.ts";

class FakePasswordRecoveryProvider implements PasswordRecoveryProvider {
  result: Result<void, PasswordRecoveryError> = ok(undefined);

  async initiateRecovery(): Promise<Result<void, PasswordRecoveryError>> {
    return this.result;
  }

  async resetPassword(): Promise<Result<void, ResetPasswordError>> {
    throw new Error("not used");
  }

  async updatePassword(): Promise<Result<void, PasswordRecoveryError>> {
    throw new Error("not used");
  }
}

describe("forgotPasswordHandler", () => {
  let handler: ReturnType<typeof createForgotPasswordHandler>;
  let provider: FakePasswordRecoveryProvider;

  beforeEach(() => {
    provider = new FakePasswordRecoveryProvider();
    const useCase = new InitiatePasswordRecoveryUseCase(provider);
    handler = createForgotPasswordHandler(useCase);
  });

  it("returns 200 { success: true } for an existing account", async () => {
    const response = await handler({ email: "user@example.com" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
  });

  it("returns the identical 200 { success: true } for a non-existent account", async () => {
    const response = await handler({ email: "no-such-account@example.com" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
  });

  it("returns 422 VALIDATION_ERROR for a malformed body", async () => {
    const response = await handler({});

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("returns 500 without leaking provider details on an unexpected failure", async () => {
    provider.result = { ok: false, error: { type: "UNEXPECTED", cause: new Error("db is down") } };

    const response = await handler({ email: "user@example.com" });

    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain("db is down");
  });
});
