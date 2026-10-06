import { err } from "@allinvites/kernel";
import { beforeEach, describe, expect, it } from "vitest";
import { CannotRemoveLastOwnerError } from "../../domain/exceptions/cannot-remove-last-owner.error";
import { createTeamManagementAuthorizationPolicy } from "../policies/create-team-management-authorization-policy";
import { RemoveUserUseCase } from "./remove-user.use-case";
import {
  buildMembership,
  buildUser,
  CALLER_ID,
  FakeOrganizationMembershipRepository,
  FakeSessionProvider,
  ORGANIZATION_ID,
  TARGET_MEMBERSHIP_ID,
  TARGET_USER_ID,
} from "./team-management-test-fakes";

describe("RemoveUserUseCase", () => {
  let sessionProvider: FakeSessionProvider;
  let membershipRepository: FakeOrganizationMembershipRepository;
  let useCase: RemoveUserUseCase;

  beforeEach(() => {
    sessionProvider = new FakeSessionProvider();
    membershipRepository = new FakeOrganizationMembershipRepository();
    membershipRepository.targetEntry = {
      membership: buildMembership({
        id: TARGET_MEMBERSHIP_ID,
        userId: TARGET_USER_ID,
        role: "MEMBER",
      }),
      user: buildUser({}),
    };
    useCase = new RemoveUserUseCase(
      sessionProvider,
      membershipRepository,
      createTeamManagementAuthorizationPolicy(),
    );
  });

  it("soft-removes the target membership (REMOVED status, not a row delete)", async () => {
    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      targetUserId: TARGET_USER_ID,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.event).toEqual(
      expect.objectContaining({
        type: "UserRemoved",
        userId: TARGET_USER_ID,
        removedBy: CALLER_ID,
      }),
    );
    expect(membershipRepository.updateStatusCalls).toEqual([
      { membershipId: TARGET_MEMBERSHIP_ID, status: "REMOVED" },
    ]);
  });

  it("returns UNAUTHORIZED for a missing/invalid session", async () => {
    sessionProvider.identityResult = err({ type: "UNAUTHORIZED" });

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      targetUserId: TARGET_USER_ID,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "UNAUTHORIZED" });
  });

  it.each(["ADMIN", "MEMBER", "CLIENT"] as const)(
    "returns FORBIDDEN for a %s caller (only OWNER may remove)",
    async (role) => {
      membershipRepository.callerMembership = buildMembership({ role });

      const result = await useCase.execute("token", {
        organizationId: ORGANIZATION_ID,
        targetUserId: TARGET_USER_ID,
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toEqual({ type: "FORBIDDEN" });
      expect(membershipRepository.updateStatusCalls).toHaveLength(0);
    },
  );

  it("returns NOT_FOUND when the target has no membership in the organization", async () => {
    membershipRepository.targetEntry = null;

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      targetUserId: "some-other-orgs-user",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "NOT_FOUND" });
  });

  it("prevents removing the last remaining active OWNER", async () => {
    membershipRepository.targetEntry = {
      membership: buildMembership({
        id: TARGET_MEMBERSHIP_ID,
        userId: TARGET_USER_ID,
        role: "OWNER",
      }),
      user: buildUser({}),
    };
    membershipRepository.activeOwnersCount = 1;

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      targetUserId: TARGET_USER_ID,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(CannotRemoveLastOwnerError);
    expect(membershipRepository.updateStatusCalls).toHaveLength(0);
  });

  it("allows removing an OWNER when another active OWNER remains", async () => {
    membershipRepository.targetEntry = {
      membership: buildMembership({
        id: TARGET_MEMBERSHIP_ID,
        userId: TARGET_USER_ID,
        role: "OWNER",
      }),
      user: buildUser({}),
    };
    membershipRepository.activeOwnersCount = 2;

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      targetUserId: TARGET_USER_ID,
    });

    expect(result.ok).toBe(true);
    expect(membershipRepository.updateStatusCalls).toEqual([
      { membershipId: TARGET_MEMBERSHIP_ID, status: "REMOVED" },
    ]);
  });
});
