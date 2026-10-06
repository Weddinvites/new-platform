import { err } from "@allinvites/kernel";
import { beforeEach, describe, expect, it } from "vitest";
import { CannotDemoteLastOwnerError } from "../../domain/exceptions/cannot-demote-last-owner.error";
import { createTeamManagementAuthorizationPolicy } from "../policies/create-team-management-authorization-policy";
import { AssignUserRoleUseCase } from "./assign-user-role.use-case";
import {
  buildMembership,
  buildUser,
  FakeOrganizationMembershipRepository,
  FakeSessionProvider,
  ORGANIZATION_ID,
  TARGET_MEMBERSHIP_ID,
  TARGET_USER_ID,
} from "./team-management-test-fakes";

describe("AssignUserRoleUseCase", () => {
  let sessionProvider: FakeSessionProvider;
  let membershipRepository: FakeOrganizationMembershipRepository;
  let useCase: AssignUserRoleUseCase;

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
    useCase = new AssignUserRoleUseCase(
      sessionProvider,
      membershipRepository,
      createTeamManagementAuthorizationPolicy(),
    );
  });

  it("assigns a new role when the caller is an OWNER", async () => {
    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      targetUserId: TARGET_USER_ID,
      role: "ADMIN",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.membership.role).toBe("ADMIN");
    expect(membershipRepository.updateRoleCalls).toEqual([
      { membershipId: TARGET_MEMBERSHIP_ID, role: "ADMIN" },
    ]);
  });

  it("returns UNAUTHORIZED for a missing/invalid session", async () => {
    sessionProvider.identityResult = err({ type: "UNAUTHORIZED" });

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      targetUserId: TARGET_USER_ID,
      role: "ADMIN",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "UNAUTHORIZED" });
  });

  it.each(["ADMIN", "MEMBER", "CLIENT"] as const)(
    "returns FORBIDDEN for a %s caller (only OWNER may assign roles)",
    async (role) => {
      membershipRepository.callerMembership = buildMembership({ role });

      const result = await useCase.execute("token", {
        organizationId: ORGANIZATION_ID,
        targetUserId: TARGET_USER_ID,
        role: "ADMIN",
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
      role: "ADMIN",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "NOT_FOUND" });
  });

  it("prevents demoting the last remaining active OWNER", async () => {
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
      role: "MEMBER",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(CannotDemoteLastOwnerError);
    expect(membershipRepository.updateRoleCalls).toHaveLength(0);
  });

  it("allows demoting an OWNER when another active OWNER remains", async () => {
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
      role: "MEMBER",
    });

    expect(result.ok).toBe(true);
    expect(membershipRepository.updateRoleCalls).toEqual([
      { membershipId: TARGET_MEMBERSHIP_ID, role: "MEMBER" },
    ]);
  });

  it("allows re-assigning OWNER to an existing OWNER without an owner-count check", async () => {
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
      role: "OWNER",
    });

    expect(result.ok).toBe(true);
  });
});
