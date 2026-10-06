import { err, ok, type Result } from "@allinvites/kernel";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  PasswordRecoveryError,
  PasswordRecoveryProvider,
  ResetPasswordError,
} from "../ports/password-recovery-provider.ts";
import { InitiatePasswordRecoveryUseCase } from "./initiate-password-recovery.use-case.ts";

class FakePasswordRecoveryProvider implements PasswordRecoveryProvider {
  result: Result<void, PasswordRecoveryError> = ok(undefined);
  calls: string[] = [];

  async initiateRecovery(email: string): Promise<Result<void, PasswordRecoveryError>> {
    this.calls.push(email);
    return this.result;
  }

  async resetPassword(): Promise<Result<void, ResetPasswordError>> {
    throw new Error("not used by InitiatePasswordRecoveryUseCase tests");
  }

  async updatePassword(): Promise<Result<void, PasswordRecoveryError>> {
    throw new Error("not used by InitiatePasswordRecoveryUseCase tests");
  }
}

describe("InitiatePasswordRecoveryUseCase", () => {
  let provider: FakePasswordRecoveryProvider;
  let useCase: InitiatePasswordRecoveryUseCase;

  beforeEach(() => {
    provider = new FakePasswordRecoveryProvider();
    useCase = new InitiatePasswordRecoveryUseCase(provider);
  });

  it("succeeds for an existing account", async () => {
    const result = await useCase.execute("user@example.com");

    expect(result.ok).toBe(true);
    expect(provider.calls).toEqual(["user@example.com"]);
  });

  it("succeeds identically for a non-existent account (non-enumeration)", async () => {
    const result = await useCase.execute("no-such-account@example.com");

    expect(result.ok).toBe(true);
  });

  it("normalizes the email (trim + lowercase) before calling the provider", async () => {
    await useCase.execute("  User@Example.com  ");

    expect(provider.calls).toEqual(["user@example.com"]);
  });

  it("propagates only a genuine provider-level technical failure", async () => {
    provider.result = err({ type: "UNEXPECTED", cause: new Error("network down") });

    const result = await useCase.execute("user@example.com");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });
});
