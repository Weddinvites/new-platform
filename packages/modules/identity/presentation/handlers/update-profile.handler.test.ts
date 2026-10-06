import { ok, type Result } from "@allinvites/kernel";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  SessionError,
  SessionProvider,
  VerifiedIdentity,
} from "../../application/ports/session-provider.ts";
import { UpdateUserProfileUseCase } from "../../application/use-cases/update-user-profile.use-case.ts";
import { User } from "../../domain/entities/user.ts";
import type { UserRepository } from "../../domain/repositories/user-repository.ts";
import { Email } from "../../domain/value-objects/email.ts";
import { FullName } from "../../domain/value-objects/full-name.ts";
import { createUpdateProfileHandler } from "./update-profile.handler.ts";

const USER_ID = "11111111-1111-1111-1111-111111111111";

class FakeSessionProvider implements SessionProvider {
  identityResult: Result<VerifiedIdentity, SessionError> = ok({ id: USER_ID });

  async getUserFromAccessToken(): Promise<Result<VerifiedIdentity, SessionError>> {
    return this.identityResult;
  }

  async refresh(): Promise<Result<never, SessionError>> {
    throw new Error("not used");
  }

  async revoke(): Promise<Result<void, SessionError>> {
    throw new Error("not used");
  }
}

function existingUser(fullName = "Jane Doe"): User {
  return User.fromPersistence({
    id: USER_ID,
    email: Email.create("user@example.com"),
    fullName: FullName.create(fullName),
    emailVerified: false,
    createdAt: new Date(),
  });
}

describe("updateProfileHandler", () => {
  let handler: ReturnType<typeof createUpdateProfileHandler>;
  let sessionProvider: FakeSessionProvider;
  let findByIdResult: User | null;

  beforeEach(() => {
    sessionProvider = new FakeSessionProvider();
    findByIdResult = existingUser();
    const userRepository: UserRepository = {
      findByEmail: async () => null,
      findById: async () => findByIdResult,
      findMembershipsByUserId: async () => [],
      save: async () => {},
      updateFullName: async (_userId, fullName) => existingUser(fullName.value),
    };
    const useCase = new UpdateUserProfileUseCase(sessionProvider, userRepository);
    handler = createUpdateProfileHandler(useCase);
  });

  it("returns 200 with the updated profile on success", async () => {
    const response = await handler("Bearer a-valid-access-token", { full_name: "New Name" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { id: USER_ID, email: "user@example.com", full_name: "New Name" },
    });
  });

  it("returns 401 UNAUTHORIZED when no Authorization header is present", async () => {
    const response = await handler(null, { full_name: "New Name" });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication is required." },
    });
  });

  it("returns 401 UNAUTHORIZED for a malformed Authorization header", async () => {
    const response = await handler("not-a-bearer-token", { full_name: "New Name" });

    expect(response.status).toBe(401);
  });

  it("returns 401 UNAUTHORIZED when the access token is invalid or expired", async () => {
    sessionProvider.identityResult = { ok: false, error: { type: "UNAUTHORIZED" } };

    const response = await handler("Bearer an-expired-token", { full_name: "New Name" });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ success: false, error: { code: "UNAUTHORIZED" } });
  });

  it("returns 422 VALIDATION_ERROR for a missing full_name", async () => {
    const response = await handler("Bearer a-valid-access-token", {});

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("returns 422 VALIDATION_ERROR for an empty-string full_name", async () => {
    const response = await handler("Bearer a-valid-access-token", { full_name: "" });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("returns 422 VALIDATION_ERROR for a full_name that is only whitespace", async () => {
    const response = await handler("Bearer a-valid-access-token", { full_name: "   " });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("returns 500 without leaking details when the authenticated user has no local profile", async () => {
    findByIdResult = null;

    const response = await handler("Bearer a-valid-access-token", { full_name: "New Name" });

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR" },
    });
  });

  it("ignores any client-supplied id and only ever resolves the user from the access token", async () => {
    const response = await handler("Bearer a-valid-access-token", {
      full_name: "New Name",
      id: "attacker-supplied-id",
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ data: { id: USER_ID } });
  });
});
