import { err } from "@allinvites/kernel";
import { beforeEach, describe, expect, it } from "vitest";
import { CannotSuspendLastOwnerError } from "../../domain/exceptions/cannot-suspend-last-owner.error";
import { createTeamManagementAuthorizationPolicy } from "../policies/create-team-management-authorization-policy";
import { SuspendUserUseCase } from "./suspend-user.use-case";
import {
  buildMembership,
  buildUser,
  FakeOrganizationMembershipRepository,
  FakeSessionProvider,
  ORGANIZATION_ID,
  TARGET_MEMBERSHIP_ID,
  TARGET_USER_ID,
} from "./team-management-test-fakes";

describe("SuspendUserUseCase", () => {
  let sessionProvider: FakeSessionProvider;
  let membershipRepository: FakeOrganizationMembershipRepository;
  let useCase: SuspendUserUseCase;

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
    useCase = new SuspendUserUseCase(
      sessionProvider,
      membershipRepository,
      createTeamManagementAuthorizationPolicy(),
    );
  });

  it("transitions an ACTIVE member to SUSPENDED when the caller is an OWNER", async () => {
    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      targetUserId: TARGET_USER_ID,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.membership.status).toBe("SUSPENDED");
    expect(membershipRepository.updateStatusCalls).toEqual([
      { membershipId: TARGET_MEMBERSHIP_ID, status: "SUSPENDED" },
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
    "returns FORBIDDEN for a %s caller (only OWNER may suspend)",
    async (role) => {
      membershipRepository.callerMembership = buildMembership({ role });

      const result = await useCase.execute("token", {
        organizationId: ORGANIZATION_ID,
        targetUserId: TARGET_USER_ID,
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toEqual({ type: "FORBIDDEN" });
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

  it("prevents suspending the last remaining active OWNER", async () => {
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
    expect(result.error).toBeInstanceOf(CannotSuspendLastOwnerError);
    expect(membershipRepository.updateStatusCalls).toHaveLength(0);
  });
});
