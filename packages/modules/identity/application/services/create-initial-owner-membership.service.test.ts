import type { Transaction } from "@allinvites/database";
import { describe, expect, it } from "vitest";
import type { OrganizationMembership } from "../../domain/entities/organization-membership";
import type {
  ListOrganizationMembersResult,
  MembershipWithUser,
  OrganizationMembershipRepository,
} from "../../domain/repositories/organization-membership-repository";
import { createCreateInitialOwnerMembershipService } from "./create-initial-owner-membership.service";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const ORGANIZATION_ID = "22222222-2222-2222-2222-222222222222";
const FAKE_TX = {} as Transaction;

class FakeOrganizationMembershipRepository implements OrganizationMembershipRepository {
  created: { membership: OrganizationMembership; tx: Transaction }[] = [];
  failure: unknown;

  async create(membership: OrganizationMembership, tx: Transaction): Promise<void> {
    if (this.failure) {
      throw this.failure;
    }
    this.created.push({ membership, tx });
  }

  async findByUserAndOrganization(): Promise<OrganizationMembership | null> {
    throw new Error("not used by createInitialOwnerMembershipService tests");
  }

  async findMemberWithUser(): Promise<MembershipWithUser | null> {
    throw new Error("not used by createInitialOwnerMembershipService tests");
  }

  async listByOrganization(): Promise<ListOrganizationMembersResult> {
    throw new Error("not used by createInitialOwnerMembershipService tests");
  }

  async countActiveOwners(): Promise<number> {
    throw new Error("not used by createInitialOwnerMembershipService tests");
  }

  async updateStatus(): Promise<OrganizationMembership> {
    throw new Error("not used by createInitialOwnerMembershipService tests");
  }

  async updateRole(): Promise<OrganizationMembership> {
    throw new Error("not used by createInitialOwnerMembershipService tests");
  }
}

describe("createInitialOwnerMembershipService", () => {
  it("creates an ACTIVE OWNER membership for the given user and organization, within the supplied transaction", async () => {
    const repository = new FakeOrganizationMembershipRepository();
    const service = createCreateInitialOwnerMembershipService(repository);

    const result = await service({ userId: USER_ID, organizationId: ORGANIZATION_ID }, FAKE_TX);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.membershipId).toBeTruthy();
    expect(repository.created).toHaveLength(1);
    const [{ membership, tx }] = repository.created;
    expect(membership.userId).toBe(USER_ID);
    expect(membership.organizationId).toBe(ORGANIZATION_ID);
    expect(membership.role).toBe("OWNER");
    expect(membership.status).toBe("ACTIVE");
    expect(tx).toBe(FAKE_TX);
  });

  it("maps a foreign key violation (23503) on user_id to USER_NOT_FOUND", async () => {
    const repository = new FakeOrganizationMembershipRepository();
    repository.failure = { code: "23503", message: "foreign key violation" };
    const service = createCreateInitialOwnerMembershipService(repository);

    const result = await service({ userId: USER_ID, organizationId: ORGANIZATION_ID }, FAKE_TX);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "USER_NOT_FOUND" });
  });

  it("propagates any other repository failure as UNEXPECTED, without leaking it as USER_NOT_FOUND", async () => {
    const repository = new FakeOrganizationMembershipRepository();
    repository.failure = new Error("connection reset");
    const service = createCreateInitialOwnerMembershipService(repository);

    const result = await service({ userId: USER_ID, organizationId: ORGANIZATION_ID }, FAKE_TX);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });
});
