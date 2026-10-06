import { err } from "@allinvites/kernel";
import { beforeEach, describe, expect, it } from "vitest";
import { createTeamManagementAuthorizationPolicy } from "../policies/create-team-management-authorization-policy";
import { ActivateUserUseCase } from "./activate-user.use-case";
import {
  buildMembership,
  buildUser,
  FakeOrganizationMembershipRepository,
  FakeSessionProvider,
  ORGANIZATION_ID,
  TARGET_MEMBERSHIP_ID,
  TARGET_USER_ID,
} from "./team-management-test-fakes";

describe("ActivateUserUseCase", () => {
  let sessionProvider: FakeSessionProvider;
  let membershipRepository: FakeOrganizationMembershipRepository;
  let useCase: ActivateUserUseCase;

  beforeEach(() => {
    sessionProvider = new FakeSessionProvider();
    membershipRepository = new FakeOrganizationMembershipRepository();
    membershipRepository.targetEntry = {
      membership: buildMembership({
        id: TARGET_MEMBERSHIP_ID,
        userId: TARGET_USER_ID,
        role: "MEMBER",
        status: "SUSPENDED",
      }),
      user: buildUser({}),
    };
    useCase = new ActivateUserUseCase(
      sessionProvider,
      membershipRepository,
      createTeamManagementAuthorizationPolicy(),
    );
  });

  it("transitions a SUSPENDED member back to ACTIVE when the caller is an OWNER", async () => {
    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      targetUserId: TARGET_USER_ID,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.membership.status).toBe("ACTIVE");
    expect(membershipRepository.updateStatusCalls).toEqual([
      { membershipId: TARGET_MEMBERSHIP_ID, status: "ACTIVE" },
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
    "returns FORBIDDEN for a %s caller (only OWNER may activate)",
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
});
