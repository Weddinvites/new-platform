import { err } from "@allinvites/kernel";
import { beforeEach, describe, expect, it } from "vitest";
import { InvalidFullNameError } from "../../domain/exceptions/invalid-full-name.error";
import type { UserRepository } from "../../domain/repositories/user-repository";
import type { FullName } from "../../domain/value-objects/full-name";
import { createTeamManagementAuthorizationPolicy } from "../policies/create-team-management-authorization-policy";
import {
  buildMembership,
  buildUser,
  FakeOrganizationMembershipRepository,
  FakeSessionProvider,
  ORGANIZATION_ID,
  TARGET_USER_ID,
} from "./team-management-test-fakes";
import { UpdateUserUseCase } from "./update-user.use-case";

describe("UpdateUserUseCase", () => {
  let sessionProvider: FakeSessionProvider;
  let membershipRepository: FakeOrganizationMembershipRepository;
  let userRepository: UserRepository;
  let updateFullNameCalls: { userId: string; fullName: string }[];
  let useCase: UpdateUserUseCase;

  beforeEach(() => {
    sessionProvider = new FakeSessionProvider();
    membershipRepository = new FakeOrganizationMembershipRepository();
    updateFullNameCalls = [];
    userRepository = {
      findByEmail: async () => null,
      findById: async () => null,
      findMembershipsByUserId: async () => [],
      save: async () => {},
      updateFullName: async (userId: string, fullName: FullName) => {
        updateFullNameCalls.push({ userId, fullName: fullName.value });
        return buildUser({ id: userId, fullName: fullName.value });
      },
    };
    useCase = new UpdateUserUseCase(
      sessionProvider,
      membershipRepository,
      createTeamManagementAuthorizationPolicy(),
      userRepository,
    );
  });

  it("updates the target user's full_name when the caller is an OWNER", async () => {
    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      targetUserId: TARGET_USER_ID,
      fullName: "New Name",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.user.fullName.value).toBe("New Name");
    expect(updateFullNameCalls).toEqual([{ userId: TARGET_USER_ID, fullName: "New Name" }]);
  });

  it("returns UNAUTHORIZED for a missing/invalid session", async () => {
    sessionProvider.identityResult = err({ type: "UNAUTHORIZED" });

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      targetUserId: TARGET_USER_ID,
      fullName: "New Name",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "UNAUTHORIZED" });
  });

  it.each(["ADMIN", "MEMBER", "CLIENT"] as const)(
    "returns FORBIDDEN for a %s caller (only OWNER may update)",
    async (role) => {
      membershipRepository.callerMembership = buildMembership({ role });

      const result = await useCase.execute("token", {
        organizationId: ORGANIZATION_ID,
        targetUserId: TARGET_USER_ID,
        fullName: "New Name",
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toEqual({ type: "FORBIDDEN" });
      expect(updateFullNameCalls).toHaveLength(0);
    },
  );

  it("returns NOT_FOUND when the target has no membership in the organization", async () => {
    membershipRepository.targetEntry = null;

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      targetUserId: "some-other-orgs-user",
      fullName: "New Name",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "NOT_FOUND" });
    expect(updateFullNameCalls).toHaveLength(0);
  });

  it("rejects an empty full_name without touching the repository", async () => {
    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      targetUserId: TARGET_USER_ID,
      fullName: "   ",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(InvalidFullNameError);
    expect(updateFullNameCalls).toHaveLength(0);
  });
});
