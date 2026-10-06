import { describe, expect, it } from "vitest";
import { OrganizationMembership } from "../../domain/entities/organization-membership";
import type {
  ListOrganizationMembersResult,
  MembershipWithUser,
  OrganizationMembershipRepository,
} from "../../domain/repositories/organization-membership-repository";
import type { MembershipStatus } from "../../domain/value-objects/membership-status";
import type { OrganizationRole } from "../../domain/value-objects/organization-role";
import { createVerifyPlatformPrivilegeService } from "./verify-platform-privilege.service";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SYSTEM_ORGANIZATION_ID = "22222222-2222-4222-8222-222222222222";

class FakeOrganizationMembershipRepository implements OrganizationMembershipRepository {
  membership: OrganizationMembership | null = null;
  failure: unknown;

  async create(): Promise<void> {
    throw new Error("not used by verifyPlatformPrivilege tests");
  }

  async findByUserAndOrganization(): Promise<OrganizationMembership | null> {
    if (this.failure) {
      throw this.failure;
    }
    return this.membership;
  }

  async findMemberWithUser(): Promise<MembershipWithUser | null> {
    throw new Error("not used by verifyPlatformPrivilege tests");
  }

  async listByOrganization(): Promise<ListOrganizationMembersResult> {
    throw new Error("not used by verifyPlatformPrivilege tests");
  }

  async countActiveOwners(): Promise<number> {
    throw new Error("not used by verifyPlatformPrivilege tests");
  }

  async updateStatus(): Promise<OrganizationMembership> {
    throw new Error("not used by verifyPlatformPrivilege tests");
  }

  async updateRole(): Promise<OrganizationMembership> {
    throw new Error("not used by verifyPlatformPrivilege tests");
  }
}

function systemMembership(
  status: MembershipStatus,
  role: OrganizationRole,
): OrganizationMembership {
  return OrganizationMembership.fromPersistence({
    id: "membership-1",
    userId: USER_ID,
    organizationId: SYSTEM_ORGANIZATION_ID,
    role,
    status,
    createdAt: new Date("2026-01-01T00:00:00Z"),
  });
}

describe("verifyPlatformPrivilege", () => {
  it.each(["OWNER", "ADMIN"] as const)(
    "succeeds for an ACTIVE %s membership in SYSTEM",
    async (role) => {
      const repository = new FakeOrganizationMembershipRepository();
      repository.membership = systemMembership("ACTIVE", role);
      const verify = createVerifyPlatformPrivilegeService(repository);

      const result = await verify({
        userId: USER_ID,
        systemOrganizationId: SYSTEM_ORGANIZATION_ID,
      });

      expect(result.ok).toBe(true);
    },
  );

  it.each(["MEMBER", "CLIENT"] as const)(
    "reports NOT_PLATFORM_PRIVILEGED for an ACTIVE %s membership in SYSTEM",
    async (role) => {
      const repository = new FakeOrganizationMembershipRepository();
      repository.membership = systemMembership("ACTIVE", role);
      const verify = createVerifyPlatformPrivilegeService(repository);

      const result = await verify({
        userId: USER_ID,
        systemOrganizationId: SYSTEM_ORGANIZATION_ID,
      });

      expect(result).toMatchObject({ ok: false, error: { type: "NOT_PLATFORM_PRIVILEGED" } });
    },
  );

  it.each(["SUSPENDED", "REMOVED"] as const)(
    "reports NOT_PLATFORM_PRIVILEGED for a %s OWNER membership in SYSTEM",
    async (status) => {
      const repository = new FakeOrganizationMembershipRepository();
      repository.membership = systemMembership(status, "OWNER");
      const verify = createVerifyPlatformPrivilegeService(repository);

      const result = await verify({
        userId: USER_ID,
        systemOrganizationId: SYSTEM_ORGANIZATION_ID,
      });

      expect(result).toMatchObject({ ok: false, error: { type: "NOT_PLATFORM_PRIVILEGED" } });
    },
  );

  it("reports NOT_PLATFORM_PRIVILEGED when the caller has no SYSTEM membership", async () => {
    const verify = createVerifyPlatformPrivilegeService(new FakeOrganizationMembershipRepository());

    const result = await verify({ userId: USER_ID, systemOrganizationId: SYSTEM_ORGANIZATION_ID });

    expect(result).toMatchObject({ ok: false, error: { type: "NOT_PLATFORM_PRIVILEGED" } });
  });

  it("reports UNEXPECTED with the cause when the repository fails", async () => {
    const repository = new FakeOrganizationMembershipRepository();
    const cause = new Error("connection reset");
    repository.failure = cause;
    const verify = createVerifyPlatformPrivilegeService(repository);

    const result = await verify({ userId: USER_ID, systemOrganizationId: SYSTEM_ORGANIZATION_ID });

    expect(result).toMatchObject({ ok: false, error: { type: "UNEXPECTED", cause } });
  });
});
