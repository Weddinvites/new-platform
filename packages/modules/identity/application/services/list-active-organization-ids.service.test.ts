import { describe, expect, it } from "vitest";
import { OrganizationMembership } from "../../domain/entities/organization-membership";
import type { User } from "../../domain/entities/user";
import type { UserRepository } from "../../domain/repositories/user-repository";
import type { MembershipStatus } from "../../domain/value-objects/membership-status";
import { createListActiveOrganizationIdsService } from "./list-active-organization-ids.service";

const USER_ID = "11111111-1111-1111-1111-111111111111";

class FakeUserRepository implements UserRepository {
  memberships: OrganizationMembership[] = [];
  failure: unknown;

  async findByEmail(): Promise<User | null> {
    throw new Error("not used by listActiveOrganizationIds tests");
  }

  async findById(): Promise<User | null> {
    throw new Error("not used by listActiveOrganizationIds tests");
  }

  async findMembershipsByUserId(): Promise<OrganizationMembership[]> {
    if (this.failure) {
      throw this.failure;
    }
    return this.memberships;
  }

  async save(): Promise<void> {
    throw new Error("not used by listActiveOrganizationIds tests");
  }

  async updateFullName(): Promise<User> {
    throw new Error("not used by listActiveOrganizationIds tests");
  }
}

function membership(organizationId: string, status: MembershipStatus): OrganizationMembership {
  return OrganizationMembership.fromPersistence({
    id: `membership-${organizationId}`,
    userId: USER_ID,
    organizationId,
    role: "MEMBER",
    status,
    createdAt: new Date(),
  });
}

describe("listActiveOrganizationIds", () => {
  it("returns only the organization ids with ACTIVE membership", async () => {
    const repository = new FakeUserRepository();
    repository.memberships = [
      membership("org-active-1", "ACTIVE"),
      membership("org-suspended", "SUSPENDED"),
      membership("org-active-2", "ACTIVE"),
      membership("org-removed", "REMOVED"),
    ];
    const service = createListActiveOrganizationIdsService(repository);

    const result = await service({ userId: USER_ID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.organizationIds).toEqual(["org-active-1", "org-active-2"]);
  });

  it("returns an empty array when the caller has no memberships at all", async () => {
    const repository = new FakeUserRepository();
    repository.memberships = [];
    const service = createListActiveOrganizationIdsService(repository);

    const result = await service({ userId: USER_ID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.organizationIds).toEqual([]);
  });

  it("returns an empty array when every membership is SUSPENDED or REMOVED", async () => {
    const repository = new FakeUserRepository();
    repository.memberships = [
      membership("org-suspended", "SUSPENDED"),
      membership("org-removed", "REMOVED"),
    ];
    const service = createListActiveOrganizationIdsService(repository);

    const result = await service({ userId: USER_ID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.organizationIds).toEqual([]);
  });

  it("includes the SYSTEM organization's id when its membership is ACTIVE (no type-based exclusion)", async () => {
    const repository = new FakeUserRepository();
    repository.memberships = [membership("system-org-id", "ACTIVE")];
    const service = createListActiveOrganizationIdsService(repository);

    const result = await service({ userId: USER_ID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.organizationIds).toEqual(["system-org-id"]);
  });

  it("propagates an unexpected repository failure as UNEXPECTED", async () => {
    const repository = new FakeUserRepository();
    repository.failure = new Error("connection reset");
    const service = createListActiveOrganizationIdsService(repository);

    const result = await service({ userId: USER_ID });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });
});
