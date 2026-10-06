import { err, ok, type Result } from "@allinvites/kernel";
import { beforeEach, describe, expect, it } from "vitest";
import { InvalidPasswordError } from "../../domain/exceptions/invalid-password.error.ts";
import { InvalidRecoveryTokenError } from "../../domain/exceptions/invalid-recovery-token.error.ts";
import type {
  PasswordRecoveryError,
  PasswordRecoveryProvider,
  ResetPasswordError as ProviderResetPasswordError,
} from "../ports/password-recovery-provider.ts";
import { ResetPasswordUseCase } from "./reset-password.use-case.ts";

class FakePasswordRecoveryProvider implements PasswordRecoveryProvider {
  result: Result<void, ProviderResetPasswordError> = ok(undefined);
  calls: { email: string; token: string; newPassword: string }[] = [];

  async initiateRecovery(): Promise<Result<void, PasswordRecoveryError>> {
    throw new Error("not used by ResetPasswordUseCase tests");
  }

  async resetPassword(params: {
    email: string;
    token: string;
    newPassword: string;
  }): Promise<Result<void, ProviderResetPasswordError>> {
    this.calls.push(params);
    return this.result;
  }

  async updatePassword(): Promise<Result<void, PasswordRecoveryError>> {
    throw new Error("not used by ResetPasswordUseCase tests");
  }
}

describe("ResetPasswordUseCase", () => {
  let provider: FakePasswordRecoveryProvider;
  let useCase: ResetPasswordUseCase;

  beforeEach(() => {
    provider = new FakePasswordRecoveryProvider();
    useCase = new ResetPasswordUseCase(provider);
  });

  it("resets the password for a valid token", async () => {
    const result = await useCase.execute({
      email: "user@example.com",
      token: "a-valid-recovery-token",
      newPassword: "a-valid-password",
    });

    expect(result.ok).toBe(true);
    expect(provider.calls).toEqual([
      {
        email: "user@example.com",
        token: "a-valid-recovery-token",
        newPassword: "a-valid-password",
      },
    ]);
  });

  it("normalizes the email before calling the provider", async () => {
    await useCase.execute({
      email: "  User@Example.com  ",
      token: "a-valid-recovery-token",
      newPassword: "a-valid-password",
    });

    expect(provider.calls[0]?.email).toBe("user@example.com");
  });

  it("rejects a password shorter than 8 characters without calling the provider", async () => {
    const result = await useCase.execute({
      email: "user@example.com",
      token: "a-valid-recovery-token",
      newPassword: "short",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(InvalidPasswordError);
    expect(provider.calls).toHaveLength(0);
  });

  it("returns InvalidRecoveryTokenError for an invalid or expired token", async () => {
    provider.result = err({ type: "INVALID_OR_EXPIRED_TOKEN" });

    const result = await useCase.execute({
      email: "user@example.com",
      token: "not-a-real-token",
      newPassword: "a-valid-password",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(InvalidRecoveryTokenError);
  });

  it("propagates an unexpected provider failure", async () => {
    provider.result = err({ type: "UNEXPECTED", cause: new Error("network down") });

    const result = await useCase.execute({
      email: "user@example.com",
      token: "a-token",
      newPassword: "a-valid-password",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({ type: "UNEXPECTED" });
  });
});
