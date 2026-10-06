import { err, ok, type Result } from "@allinvites/kernel";
import { beforeEach, describe, expect, it } from "vitest";
import { User } from "../../domain/entities/user.ts";
import { InvalidFullNameError } from "../../domain/exceptions/invalid-full-name.error.ts";
import type { UserRepository } from "../../domain/repositories/user-repository.ts";
import { Email } from "../../domain/value-objects/email.ts";
import { FullName } from "../../domain/value-objects/full-name.ts";
import type { SessionError, SessionProvider, VerifiedIdentity } from "../ports/session-provider.ts";
import { UpdateUserProfileUseCase } from "./update-user-profile.use-case.ts";

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

describe("UpdateUserProfileUseCase", () => {
  let sessionProvider: FakeSessionProvider;
  let userRepository: UserRepository;
  let updateCalls: { userId: string; fullName: string }[];
  let findByIdResult: User | null;
  let useCase: UpdateUserProfileUseCase;

  beforeEach(() => {
    sessionProvider = new FakeSessionProvider();
    updateCalls = [];
    findByIdResult = existingUser();
    userRepository = {
      findByEmail: async () => null,
      findById: async () => findByIdResult,
      findMembershipsByUserId: async () => [],
      save: async () => {},
      updateFullName: async (userId, fullName) => {
        updateCalls.push({ userId, fullName: fullName.value });
        return existingUser(fullName.value);
      },
    };
    useCase = new UpdateUserProfileUseCase(sessionProvider, userRepository);
  });

  it("updates full_name for the authenticated user", async () => {
    const result = await useCase.execute("a-valid-access-token", { fullName: "New Name" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.user.fullName.value).toBe("New Name");
    expect(updateCalls).toEqual([{ userId: USER_ID, fullName: "New Name" }]);
  });

  it("returns UNAUTHORIZED for an invalid/expired access token, without touching the repository", async () => {
    sessionProvider.identityResult = err({ type: "UNAUTHORIZED" });

    const result = await useCase.execute("an-expired-token", { fullName: "New Name" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "UNAUTHORIZED" });
    expect(updateCalls).toHaveLength(0);
  });

  it("returns UNEXPECTED (not UNAUTHORIZED) when a valid token has no matching local profile", async () => {
    findByIdResult = null;

    const result = await useCase.execute("a-valid-access-token", { fullName: "New Name" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({ type: "UNEXPECTED" });
    expect(updateCalls).toHaveLength(0);
  });

  it("rejects an empty full_name without calling the repository update", async () => {
    const result = await useCase.execute("a-valid-access-token", { fullName: "   " });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(InvalidFullNameError);
    expect(updateCalls).toHaveLength(0);
  });

  it("propagates an unexpected session-provider failure", async () => {
    sessionProvider.identityResult = err({ type: "UNEXPECTED", cause: new Error("network down") });

    const result = await useCase.execute("a-token", { fullName: "New Name" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({ type: "UNEXPECTED" });
  });
});
