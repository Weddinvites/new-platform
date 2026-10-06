import { ok, type Result } from "@allinvites/kernel";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  AuthSessionProvider,
  CreatedAuthUser,
  SignInError,
} from "../../application/ports/auth-provider.ts";
import type {
  PasswordRecoveryError,
  PasswordRecoveryProvider,
  ResetPasswordError,
} from "../../application/ports/password-recovery-provider.ts";
import type {
  SessionError,
  SessionProvider,
  VerifiedIdentity,
} from "../../application/ports/session-provider.ts";
import { ChangePasswordUseCase } from "../../application/use-cases/change-password.use-case.ts";
import { User } from "../../domain/entities/user.ts";
import type { UserRepository } from "../../domain/repositories/user-repository.ts";
import { Email } from "../../domain/value-objects/email.ts";
import { FullName } from "../../domain/value-objects/full-name.ts";
import { createChangePasswordHandler } from "./change-password.handler.ts";

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
    session: { accessToken: "unused", refreshToken: "unused" },
  });

  async signIn(): Promise<Result<CreatedAuthUser, SignInError>> {
    return this.signInResult;
  }
}

class FakePasswordRecoveryProvider implements PasswordRecoveryProvider {
  updateResult: Result<void, PasswordRecoveryError> = ok(undefined);

  async initiateRecovery(): Promise<Result<void, PasswordRecoveryError>> {
    throw new Error("not used");
  }

  async resetPassword(): Promise<Result<void, ResetPasswordError>> {
    throw new Error("not used");
  }

  async updatePassword(): Promise<Result<void, PasswordRecoveryError>> {
    return this.updateResult;
  }
}

describe("changePasswordHandler", () => {
  let handler: ReturnType<typeof createChangePasswordHandler>;
  let sessionProvider: FakeSessionProvider;
  let authSessionProvider: FakeAuthSessionProvider;
  let passwordRecoveryProvider: FakePasswordRecoveryProvider;

  beforeEach(() => {
    sessionProvider = new FakeSessionProvider();
    authSessionProvider = new FakeAuthSessionProvider();
    passwordRecoveryProvider = new FakePasswordRecoveryProvider();
    const userRepository: UserRepository = {
      findByEmail: async () => null,
      findById: async () =>
        User.fromPersistence({
          id: USER_ID,
          email: Email.create("user@example.com"),
          fullName: FullName.create("Jane Doe"),
          emailVerified: false,
          createdAt: new Date(),
        }),
      findMembershipsByUserId: async () => [],
      save: async () => {},
      updateFullName: async () => {
        throw new Error("not used by changePasswordHandler tests");
      },
    };
    const useCase = new ChangePasswordUseCase(
      sessionProvider,
      userRepository,
      authSessionProvider,
      passwordRecoveryProvider,
    );
    handler = createChangePasswordHandler(useCase);
  });

  it("returns 200 { success: true } on a successful change", async () => {
    const response = await handler("Bearer a-valid-access-token", {
      current_password: "the-current-password",
      new_password: "a-new-valid-password",
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
  });

  it("returns 401 UNAUTHORIZED when no Authorization header is present", async () => {
    const response = await handler(null, {
      current_password: "the-current-password",
      new_password: "a-new-valid-password",
    });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication is required." },
    });
  });

  it("returns 422 VALIDATION_ERROR for a missing current_password", async () => {
    const response = await handler("Bearer a-valid-access-token", {
      new_password: "a-new-valid-password",
    });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("returns 422 VALIDATION_ERROR for a missing new_password", async () => {
    const response = await handler("Bearer a-valid-access-token", {
      current_password: "the-current-password",
    });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("returns 422 VALIDATION_ERROR for a new password outside the 8-72 character policy", async () => {
    const response = await handler("Bearer a-valid-access-token", {
      current_password: "the-current-password",
      new_password: "short",
    });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("returns 401 INVALID_CREDENTIALS for an incorrect current password", async () => {
    authSessionProvider.signInResult = { ok: false, error: { type: "INVALID_CREDENTIALS" } };

    const response = await handler("Bearer a-valid-access-token", {
      current_password: "wrong-current-password",
      new_password: "a-new-valid-password",
    });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "INVALID_CREDENTIALS" },
    });
  });

  it("returns 500 without leaking provider details on an unexpected failure", async () => {
    passwordRecoveryProvider.updateResult = {
      ok: false,
      error: { type: "UNEXPECTED", cause: new Error("db is down") },
    };

    const response = await handler("Bearer a-valid-access-token", {
      current_password: "the-current-password",
      new_password: "a-new-valid-password",
    });

    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain("db is down");
  });

  it("never includes the current or new password in a response body", async () => {
    authSessionProvider.signInResult = { ok: false, error: { type: "INVALID_CREDENTIALS" } };

    const response = await handler("Bearer a-valid-access-token", {
      current_password: "super-secret-current-password",
      new_password: "super-secret-new-password",
    });

    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain("super-secret-current-password");
    expect(serialized).not.toContain("super-secret-new-password");
  });
});
