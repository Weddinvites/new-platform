import { describe, expect, it } from "vitest";
import { OrganizationMembership } from "../../domain/entities/organization-membership";
import type {
  ListOrganizationMembersResult,
  MembershipWithUser,
  OrganizationMembershipRepository,
} from "../../domain/repositories/organization-membership-repository";
import type { MembershipStatus } from "../../domain/value-objects/membership-status";
import type { OrganizationRole } from "../../domain/value-objects/organization-role";
import { createVerifyOwnerMembershipService } from "./verify-owner-membership.service";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ORGANIZATION_ID = "22222222-2222-4222-8222-222222222222";

class FakeOrganizationMembershipRepository implements OrganizationMembershipRepository {
  membership: OrganizationMembership | null = null;
  failure: unknown;

  async create(): Promise<void> {
    throw new Error("not used by verifyOwnerMembership tests");
  }

  async findByUserAndOrganization(): Promise<OrganizationMembership | null> {
    if (this.failure) {
      throw this.failure;
    }
    return this.membership;
  }

  async findMemberWithUser(): Promise<MembershipWithUser | null> {
    throw new Error("not used by verifyOwnerMembership tests");
  }

  async listByOrganization(): Promise<ListOrganizationMembersResult> {
    throw new Error("not used by verifyOwnerMembership tests");
  }

  async countActiveOwners(): Promise<number> {
    throw new Error("not used by verifyOwnerMembership tests");
  }

  async updateStatus(): Promise<OrganizationMembership> {
    throw new Error("not used by verifyOwnerMembership tests");
  }

  async updateRole(): Promise<OrganizationMembership> {
    throw new Error("not used by verifyOwnerMembership tests");
  }
}

function membership(
  status: MembershipStatus,
  role: OrganizationRole = "OWNER",
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

describe("verifyOwnerMembership", () => {
  it("succeeds for an ACTIVE OWNER membership", async () => {
    const repository = new FakeOrganizationMembershipRepository();
    repository.membership = membership("ACTIVE", "OWNER");
    const service = createVerifyOwnerMembershipService(repository);

    const result = await service({ userId: USER_ID, organizationId: ORGANIZATION_ID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeUndefined();
  });

  it("returns NOT_ACTIVE_MEMBER for a SUSPENDED membership, even if the role is OWNER", async () => {
    const repository = new FakeOrganizationMembershipRepository();
    repository.membership = membership("SUSPENDED", "OWNER");
    const service = createVerifyOwnerMembershipService(repository);

    const result = await service({ userId: USER_ID, organizationId: ORGANIZATION_ID });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "NOT_ACTIVE_MEMBER" });
  });

  it("returns NOT_ACTIVE_MEMBER for a REMOVED membership", async () => {
    const repository = new FakeOrganizationMembershipRepository();
    repository.membership = membership("REMOVED", "OWNER");
    const service = createVerifyOwnerMembershipService(repository);

    const result = await service({ userId: USER_ID, organizationId: ORGANIZATION_ID });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "NOT_ACTIVE_MEMBER" });
  });

  it("returns NOT_ACTIVE_MEMBER when no membership exists at all", async () => {
    const repository = new FakeOrganizationMembershipRepository();
    repository.membership = null;
    const service = createVerifyOwnerMembershipService(repository);

    const result = await service({ userId: USER_ID, organizationId: ORGANIZATION_ID });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "NOT_ACTIVE_MEMBER" });
  });

  it("does not distinguish SUSPENDED, REMOVED, or missing — identical NOT_ACTIVE_MEMBER result", async () => {
    const scenarios: (MembershipStatus | null)[] = ["SUSPENDED", "REMOVED", null];

    const results = await Promise.all(
      scenarios.map((status) => {
        const repository = new FakeOrganizationMembershipRepository();
        repository.membership = status ? membership(status, "OWNER") : null;
        return createVerifyOwnerMembershipService(repository)({
          userId: USER_ID,
          organizationId: ORGANIZATION_ID,
        });
      }),
    );

    for (const result of results) {
      expect(result).toEqual({ ok: false, error: { type: "NOT_ACTIVE_MEMBER" } });
    }
  });

  it("returns NOT_OWNER for an ACTIVE ADMIN membership", async () => {
    const repository = new FakeOrganizationMembershipRepository();
    repository.membership = membership("ACTIVE", "ADMIN");
    const service = createVerifyOwnerMembershipService(repository);

    const result = await service({ userId: USER_ID, organizationId: ORGANIZATION_ID });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "NOT_OWNER" });
  });

  it("returns NOT_OWNER for an ACTIVE MEMBER membership", async () => {
    const repository = new FakeOrganizationMembershipRepository();
    repository.membership = membership("ACTIVE", "MEMBER");
    const service = createVerifyOwnerMembershipService(repository);

    const result = await service({ userId: USER_ID, organizationId: ORGANIZATION_ID });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "NOT_OWNER" });
  });

  it("returns NOT_OWNER for an ACTIVE CLIENT membership", async () => {
    const repository = new FakeOrganizationMembershipRepository();
    repository.membership = membership("ACTIVE", "CLIENT");
    const service = createVerifyOwnerMembershipService(repository);

    const result = await service({ userId: USER_ID, organizationId: ORGANIZATION_ID });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "NOT_OWNER" });
  });

  it("never returns the membership entity, actual role, or RBAC internals in the error", async () => {
    const repository = new FakeOrganizationMembershipRepository();
    repository.membership = membership("ACTIVE", "ADMIN");
    const service = createVerifyOwnerMembershipService(repository);

    const result = await service({ userId: USER_ID, organizationId: ORGANIZATION_ID });

    expect(result).toEqual({ ok: false, error: { type: "NOT_OWNER" } });
  });

  it("propagates an unexpected repository failure as UNEXPECTED", async () => {
    const repository = new FakeOrganizationMembershipRepository();
    repository.failure = new Error("connection reset");
    const service = createVerifyOwnerMembershipService(repository);

    const result = await service({ userId: USER_ID, organizationId: ORGANIZATION_ID });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });
});
