import { err } from "@allinvites/kernel";
import { beforeEach, describe, expect, it } from "vitest";
import { createTeamManagementAuthorizationPolicy } from "../policies/create-team-management-authorization-policy";
import { GetUserUseCase } from "./get-user.use-case";
import {
  buildMembership,
  buildUser,
  FakeOrganizationMembershipRepository,
  FakeSessionProvider,
  ORGANIZATION_ID,
  TARGET_USER_ID,
} from "./team-management-test-fakes";

describe("GetUserUseCase", () => {
  let sessionProvider: FakeSessionProvider;
  let membershipRepository: FakeOrganizationMembershipRepository;
  let useCase: GetUserUseCase;

  beforeEach(() => {
    sessionProvider = new FakeSessionProvider();
    membershipRepository = new FakeOrganizationMembershipRepository();
    useCase = new GetUserUseCase(
      sessionProvider,
      membershipRepository,
      createTeamManagementAuthorizationPolicy(),
    );
  });

  it("returns the target user's identity and membership when the caller is an OWNER", async () => {
    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      targetUserId: TARGET_USER_ID,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.user.id).toBe(TARGET_USER_ID);
    expect(result.value.membership.organizationId).toBe(ORGANIZATION_ID);
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

  it("returns FORBIDDEN when the caller has no membership in the organization", async () => {
    membershipRepository.callerMembership = null;

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      targetUserId: TARGET_USER_ID,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "FORBIDDEN" });
  });

  it.each(["ADMIN", "MEMBER", "CLIENT"] as const)(
    "returns FORBIDDEN for a %s caller (only OWNER may read)",
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

  it("returns NOT_FOUND when the target has no membership in the organization (cross-organization access)", async () => {
    membershipRepository.targetEntry = null;

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      targetUserId: "some-other-orgs-user",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "NOT_FOUND" });
  });

  it("reflects the target's current lifecycle status", async () => {
    membershipRepository.targetEntry = {
      membership: buildMembership({ userId: TARGET_USER_ID, status: "SUSPENDED" }),
      user: buildUser({}),
    };

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      targetUserId: TARGET_USER_ID,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.membership.status).toBe("SUSPENDED");
  });
});
