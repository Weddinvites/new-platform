import { describe, expect, it } from "vitest";
import { OrganizationMembership } from "../../domain/entities/organization-membership";
import type {
  ListOrganizationMembersResult,
  MembershipWithUser,
  OrganizationMembershipRepository,
} from "../../domain/repositories/organization-membership-repository";
import type { MembershipStatus } from "../../domain/value-objects/membership-status";
import type { OrganizationRole } from "../../domain/value-objects/organization-role";
import { createVerifyActiveMembershipService } from "./verify-active-membership.service";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const ORGANIZATION_ID = "22222222-2222-2222-2222-222222222222";

class FakeOrganizationMembershipRepository implements OrganizationMembershipRepository {
  membership: OrganizationMembership | null = null;
  failure: unknown;

  async create(): Promise<void> {
    throw new Error("not used by verifyActiveMembership tests");
  }

  async findByUserAndOrganization(): Promise<OrganizationMembership | null> {
    if (this.failure) {
      throw this.failure;
    }
    return this.membership;
  }

  async findMemberWithUser(): Promise<MembershipWithUser | null> {
    throw new Error("not used by verifyActiveMembership tests");
  }

  async listByOrganization(): Promise<ListOrganizationMembersResult> {
    throw new Error("not used by verifyActiveMembership tests");
  }

  async countActiveOwners(): Promise<number> {
    throw new Error("not used by verifyActiveMembership tests");
  }

  async updateStatus(): Promise<OrganizationMembership> {
    throw new Error("not used by verifyActiveMembership tests");
  }

  async updateRole(): Promise<OrganizationMembership> {
    throw new Error("not used by verifyActiveMembership tests");
  }
}

function membership(
  status: MembershipStatus,
  role: OrganizationRole = "MEMBER",
): OrganizationMembership {
  return OrganizationMembership.fromPersistence({
    id: "membership-1",
    userId: USER_ID,
    organizationId: ORGANIZATION_ID,
    role,
    status,
    createdAt: new Date(),
  });
}

describe("verifyActiveMembership", () => {
  it("succeeds for an ACTIVE membership, regardless of role", async () => {
    const repository = new FakeOrganizationMembershipRepository();
    repository.membership = membership("ACTIVE", "CLIENT");
    const service = createVerifyActiveMembershipService(repository);

    const result = await service({ userId: USER_ID, organizationId: ORGANIZATION_ID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeUndefined();
  });

  it("returns NOT_A_MEMBER for a SUSPENDED membership", async () => {
    const repository = new FakeOrganizationMembershipRepository();
    repository.membership = membership("SUSPENDED");
    const service = createVerifyActiveMembershipService(repository);

    const result = await service({ userId: USER_ID, organizationId: ORGANIZATION_ID });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "NOT_A_MEMBER" });
  });

  it("returns NOT_A_MEMBER for a REMOVED membership", async () => {
    const repository = new FakeOrganizationMembershipRepository();
    repository.membership = membership("REMOVED");
    const service = createVerifyActiveMembershipService(repository);

    const result = await service({ userId: USER_ID, organizationId: ORGANIZATION_ID });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "NOT_A_MEMBER" });
  });

  it("returns NOT_A_MEMBER when no membership exists at all", async () => {
    const repository = new FakeOrganizationMembershipRepository();
    repository.membership = null;
    const service = createVerifyActiveMembershipService(repository);

    const result = await service({ userId: USER_ID, organizationId: ORGANIZATION_ID });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "NOT_A_MEMBER" });
  });

  it("does not distinguish SUSPENDED, REMOVED, or missing — identical NOT_A_MEMBER result", async () => {
    const scenarios: (MembershipStatus | null)[] = ["SUSPENDED", "REMOVED", null];

    const results = await Promise.all(
      scenarios.map((status) => {
        const repository = new FakeOrganizationMembershipRepository();
        repository.membership = status ? membership(status) : null;
        return createVerifyActiveMembershipService(repository)({
          userId: USER_ID,
          organizationId: ORGANIZATION_ID,
        });
      }),
    );

    for (const result of results) {
      expect(result).toEqual({ ok: false, error: { type: "NOT_A_MEMBER" } });
    }
  });

  it("propagates an unexpected repository failure as UNEXPECTED", async () => {
    const repository = new FakeOrganizationMembershipRepository();
    repository.failure = new Error("connection reset");
    const service = createVerifyActiveMembershipService(repository);

    const result = await service({ userId: USER_ID, organizationId: ORGANIZATION_ID });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });
});
