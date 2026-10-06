import { err } from "@allinvites/kernel";
import { beforeEach, describe, expect, it } from "vitest";
import { createTeamManagementAuthorizationPolicy } from "../policies/create-team-management-authorization-policy";
import { ListUsersUseCase } from "./list-users.use-case";
import {
  buildMembership,
  buildUser,
  FakeOrganizationMembershipRepository,
  FakeSessionProvider,
  ORGANIZATION_ID,
} from "./team-management-test-fakes";

describe("ListUsersUseCase", () => {
  let sessionProvider: FakeSessionProvider;
  let membershipRepository: FakeOrganizationMembershipRepository;
  let useCase: ListUsersUseCase;

  beforeEach(() => {
    sessionProvider = new FakeSessionProvider();
    membershipRepository = new FakeOrganizationMembershipRepository();
    useCase = new ListUsersUseCase(
      sessionProvider,
      membershipRepository,
      createTeamManagementAuthorizationPolicy(),
    );
  });

  it("returns the organization's members when the caller is an OWNER", async () => {
    membershipRepository.listResult = {
      items: [{ membership: buildMembership({}), user: buildUser({}) }],
      total: 1,
    };

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      page: 1,
      pageSize: 25,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total).toBe(1);
    expect(result.value.items).toHaveLength(1);
  });

  it("returns UNAUTHORIZED for a missing/invalid session", async () => {
    sessionProvider.identityResult = err({ type: "UNAUTHORIZED" });

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      page: 1,
      pageSize: 25,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "UNAUTHORIZED" });
  });

  it("returns FORBIDDEN when the caller has no membership in the organization", async () => {
    membershipRepository.callerMembership = null;

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      page: 1,
      pageSize: 25,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "FORBIDDEN" });
  });

  it.each(["ADMIN", "MEMBER", "CLIENT"] as const)(
    "returns FORBIDDEN for a %s caller (only OWNER may list)",
    async (role) => {
      membershipRepository.callerMembership = buildMembership({ role });

      const result = await useCase.execute("token", {
        organizationId: ORGANIZATION_ID,
        page: 1,
        pageSize: 25,
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toEqual({ type: "FORBIDDEN" });
    },
  );
});
