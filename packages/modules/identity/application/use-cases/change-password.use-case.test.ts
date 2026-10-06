import { err, ok, type Result } from "@allinvites/kernel";
import { beforeEach, describe, expect, it } from "vitest";
import { User } from "../../domain/entities/user.ts";
import { InvalidCurrentPasswordError } from "../../domain/exceptions/invalid-current-password.error.ts";
import { InvalidPasswordError } from "../../domain/exceptions/invalid-password.error.ts";
import type { UserRepository } from "../../domain/repositories/user-repository.ts";
import { Email } from "../../domain/value-objects/email.ts";
import { FullName } from "../../domain/value-objects/full-name.ts";
import type { AuthSessionProvider, CreatedAuthUser, SignInError } from "../ports/auth-provider.ts";
import type {
  PasswordRecoveryError,
  PasswordRecoveryProvider,
  ResetPasswordError,
} from "../ports/password-recovery-provider.ts";
import type { SessionError, SessionProvider, VerifiedIdentity } from "../ports/session-provider.ts";
import { ChangePasswordUseCase } from "./change-password.use-case.ts";

const USER_ID = "11111111-1111-1111-1111-111111111111";

class FakeSessionProvider implements SessionProvider {
  identityResult: Result<VerifiedIdentity, SessionError> = ok({ id: USER_ID });

  async getUserFromAccessToken(): Promise<Result<VerifiedIdentity, SessionError>> {
    return this.identityResult;
  }

  async refresh(): Promise<Result<CreatedAuthUser, SessionError>> {
    throw new Error("not used");
  }

  async revoke(): Promise<Result<void, SessionError>> {
    throw new Error("not used");
  }
}

class FakeAuthSessionProvider implements AuthSessionProvider {
  signInResult: Result<CreatedAuthUser, SignInError> = ok({
    id: USER_ID,
    session: { accessToken: "unused-token", refreshToken: "unused-token" },
  });
  calls: { email: string; password: string }[] = [];

  async signIn(params: {
    email: string;
    password: string;
  }): Promise<Result<CreatedAuthUser, SignInError>> {
    this.calls.push(params);
    return this.signInResult;
  }
}

class FakePasswordRecoveryProvider implements PasswordRecoveryProvider {
  updateResult: Result<void, PasswordRecoveryError> = ok(undefined);
  updateCalls: { userId: string; newPassword: string }[] = [];

  async initiateRecovery(): Promise<Result<void, PasswordRecoveryError>> {
    throw new Error("not used");
  }

  async resetPassword(): Promise<Result<void, ResetPasswordError>> {
    throw new Error("not used");
  }

  async updatePassword(
    userId: string,
    newPassword: string,
  ): Promise<Result<void, PasswordRecoveryError>> {
    this.updateCalls.push({ userId, newPassword });
    return this.updateResult;
  }
}

describe("ChangePasswordUseCase", () => {
  let sessionProvider: FakeSessionProvider;
  let authSessionProvider: FakeAuthSessionProvider;
  let passwordRecoveryProvider: FakePasswordRecoveryProvider;
  let userRepository: UserRepository;
  let useCase: ChangePasswordUseCase;

  beforeEach(() => {
    sessionProvider = new FakeSessionProvider();
    authSessionProvider = new FakeAuthSessionProvider();
    passwordRecoveryProvider = new FakePasswordRecoveryProvider();
    userRepository = {
      findByEmail: async () => null,
      findById: async (id: string) =>
        id === USER_ID
          ? User.fromPersistence({
              id: USER_ID,
              email: Email.create("user@example.com"),
              fullName: FullName.create("Jane Doe"),
              emailVerified: false,
              createdAt: new Date(),
            })
          : null,
      findMembershipsByUserId: async () => [],
      save: async () => {},
      updateFullName: async () => {
        throw new Error("not used by ChangePasswordUseCase tests");
      },
    };
    useCase = new ChangePasswordUseCase(
      sessionProvider,
      userRepository,
      authSessionProvider,
      passwordRecoveryProvider,
    );
  });

  it("changes the password when the current password is correct", async () => {
    const result = await useCase.execute("a-valid-access-token", {
      currentPassword: "the-current-password",
      newPassword: "a-new-valid-password",
    });

    expect(result.ok).toBe(true);
    expect(authSessionProvider.calls).toEqual([
      { email: "user@example.com", password: "the-current-password" },
    ]);
    expect(passwordRecoveryProvider.updateCalls).toEqual([
      { userId: USER_ID, newPassword: "a-new-valid-password" },
    ]);
  });

  it("returns UNAUTHORIZED for an invalid/expired access token", async () => {
    sessionProvider.identityResult = err({ type: "UNAUTHORIZED" });

    const result = await useCase.execute("an-expired-token", {
      currentPassword: "the-current-password",
      newPassword: "a-new-valid-password",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "UNAUTHORIZED" });
    expect(authSessionProvider.calls).toHaveLength(0);
  });

  it("rejects a new password shorter than 8 characters without verifying the current password", async () => {
    const result = await useCase.execute("a-valid-access-token", {
      currentPassword: "the-current-password",
      newPassword: "short",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(InvalidPasswordError);
    expect(authSessionProvider.calls).toHaveLength(0);
    expect(passwordRecoveryProvider.updateCalls).toHaveLength(0);
  });

  it("returns InvalidCurrentPasswordError for an incorrect current password", async () => {
    authSessionProvider.signInResult = err({ type: "INVALID_CREDENTIALS" });

    const result = await useCase.execute("a-valid-access-token", {
      currentPassword: "wrong-current-password",
      newPassword: "a-new-valid-password",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(InvalidCurrentPasswordError);
    expect(passwordRecoveryProvider.updateCalls).toHaveLength(0);
  });

  it("propagates an unexpected failure while verifying the current password", async () => {
    authSessionProvider.signInResult = err({
      type: "UNEXPECTED",
      cause: new Error("network down"),
    });

    const result = await useCase.execute("a-valid-access-token", {
      currentPassword: "the-current-password",
      newPassword: "a-new-valid-password",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({ type: "UNEXPECTED" });
  });

  it("propagates an unexpected failure while updating the password", async () => {
    passwordRecoveryProvider.updateResult = err({
      type: "UNEXPECTED",
      cause: new Error("db is down"),
    });

    const result = await useCase.execute("a-valid-access-token", {
      currentPassword: "the-current-password",
      newPassword: "a-new-valid-password",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({ type: "UNEXPECTED" });
  });
});
