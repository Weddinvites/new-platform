import { err, ok, type Result } from "@allinvites/kernel";
import { beforeEach, describe, expect, it } from "vitest";
import { InvalidCredentialsError } from "../../domain/exceptions/invalid-credentials.error.ts";
import type { AuthSessionProvider, CreatedAuthUser, SignInError } from "../ports/auth-provider.ts";
import { LoginUserUseCase } from "./login-user.use-case.ts";

class FakeAuthSessionProvider implements AuthSessionProvider {
  result: Result<CreatedAuthUser, SignInError> = ok({
    id: "11111111-1111-1111-1111-111111111111",
    session: { accessToken: "access-token", refreshToken: "refresh-token" },
  });
  calls: { email: string; password: string }[] = [];

  async signIn(params: {
    email: string;
    password: string;
  }): Promise<Result<CreatedAuthUser, SignInError>> {
    this.calls.push(params);
    return this.result;
  }
}

describe("LoginUserUseCase", () => {
  let authSessionProvider: FakeAuthSessionProvider;
  let useCase: LoginUserUseCase;

  beforeEach(() => {
    authSessionProvider = new FakeAuthSessionProvider();
    useCase = new LoginUserUseCase(authSessionProvider);
  });

  it("returns a session and a UserAuthenticated event on valid credentials", async () => {
    const result = await useCase.execute({
      email: "user@example.com",
      password: "a-valid-password",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.session.accessToken).toBe("access-token");
    expect(result.value.session.refreshToken).toBe("refresh-token");
    expect(result.value.event).toMatchObject({
      type: "UserAuthenticated",
      userId: "11111111-1111-1111-1111-111111111111",
    });
  });

  it("normalizes the email (trim + lowercase) before calling the provider", async () => {
    await useCase.execute({ email: "  User@Example.com  ", password: "a-valid-password" });

    expect(authSessionProvider.calls).toEqual([
      { email: "user@example.com", password: "a-valid-password" },
    ]);
  });

  it("passes the plaintext password through to the provider unchanged", async () => {
    await useCase.execute({ email: "user@example.com", password: "a-valid-password" });

    expect(authSessionProvider.calls[0]?.password).toBe("a-valid-password");
  });

  it("returns InvalidCredentialsError for wrong credentials, without revealing the cause", async () => {
    authSessionProvider.result = err({ type: "INVALID_CREDENTIALS" });

    const result = await useCase.execute({ email: "user@example.com", password: "wrong-password" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(InvalidCredentialsError);
  });

  it("returns InvalidCredentialsError identically for a non-existent account", async () => {
    authSessionProvider.result = err({ type: "INVALID_CREDENTIALS" });

    const result = await useCase.execute({
      email: "no-such-account@example.com",
      password: "whatever",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(InvalidCredentialsError);
  });

  it("propagates an unexpected provider failure without exposing it as credentials", async () => {
    authSessionProvider.result = err({ type: "UNEXPECTED", cause: new Error("network down") });

    const result = await useCase.execute({
      email: "user@example.com",
      password: "a-valid-password",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({ type: "UNEXPECTED" });
  });
});
