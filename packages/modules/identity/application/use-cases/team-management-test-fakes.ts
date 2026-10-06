import { ok, type Result } from "@allinvites/kernel";
import { OrganizationMembership } from "../../domain/entities/organization-membership";
import { User } from "../../domain/entities/user";
import type {
  ListOrganizationMembersResult,
  MembershipWithUser,
  OrganizationMembershipRepository,
} from "../../domain/repositories/organization-membership-repository";
import { Email } from "../../domain/value-objects/email";
import { FullName } from "../../domain/value-objects/full-name";
import type { MembershipStatus } from "../../domain/value-objects/membership-status";
import type { OrganizationRole } from "../../domain/value-objects/organization-role";
import type { CreatedAuthUser } from "../ports/auth-provider";
import type { SessionError, SessionProvider, VerifiedIdentity } from "../ports/session-provider";

/**
 * Shared test doubles/builders for STORY-002-007's use-case tests. Local
 * fakes-per-file remains this codebase's convention (see
 * change-password.use-case.test.ts); this shared module exists specifically
 * for the 8 team-management use cases, which all depend on the identical
 * SessionProvider/OrganizationMembershipRepository/AuthorizationPolicy
 * shape — avoiding eight near-identical copies of the same fakes.
 */

export const CALLER_ID = "11111111-1111-1111-1111-111111111111";
export const ORGANIZATION_ID = "22222222-2222-2222-2222-222222222222";
export const TARGET_USER_ID = "33333333-3333-3333-3333-333333333333";
export const CALLER_MEMBERSHIP_ID = "44444444-4444-4444-4444-444444444444";
export const TARGET_MEMBERSHIP_ID = "55555555-5555-5555-5555-555555555555";

export function buildMembership(params: {
  id?: string;
  userId?: string;
  organizationId?: string;
  role?: OrganizationRole;
  status?: MembershipStatus;
}): OrganizationMembership {
  return OrganizationMembership.fromPersistence({
    id: params.id ?? CALLER_MEMBERSHIP_ID,
    userId: params.userId ?? CALLER_ID,
    organizationId: params.organizationId ?? ORGANIZATION_ID,
    role: params.role ?? "OWNER",
    status: params.status ?? "ACTIVE",
    createdAt: new Date(),
  });
}

export function buildUser(params: { id?: string; email?: string; fullName?: string }): User {
  return User.fromPersistence({
    id: params.id ?? TARGET_USER_ID,
    email: Email.create(params.email ?? "target@example.com"),
    fullName: FullName.create(params.fullName ?? "Target User"),
    emailVerified: true,
    createdAt: new Date(),
  });
}

export class FakeSessionProvider implements SessionProvider {
  identityResult: Result<VerifiedIdentity, SessionError> = ok({ id: CALLER_ID });

  async getUserFromAccessToken(): Promise<Result<VerifiedIdentity, SessionError>> {
    return this.identityResult;
  }

  async refresh(): Promise<Result<CreatedAuthUser, SessionError>> {
    throw new Error("not used");
  }

  async revoke(): Promise<Result<void, SessionError>> {
    throw new Error("not used");
  }
}

/**
 * Defaults to a caller who is an ACTIVE OWNER of ORGANIZATION_ID (so tests
 * opt into an authorization-denial scenario explicitly, matching the
 * "SUPPORTED/allowed by default, denial is the exception under test"
 * convention already used by ChangePasswordUseCase's tests), and a target
 * member who exists in the same organization.
 */
export class FakeOrganizationMembershipRepository implements OrganizationMembershipRepository {
  callerMembership: OrganizationMembership | null = buildMembership({ role: "OWNER" });
  targetEntry: MembershipWithUser | null = {
    membership: buildMembership({ id: TARGET_MEMBERSHIP_ID, userId: TARGET_USER_ID }),
    user: buildUser({}),
  };
  activeOwnersCount = 2;
  listResult: ListOrganizationMembersResult = { items: [], total: 0 };
  updateStatusCalls: { membershipId: string; status: MembershipStatus }[] = [];
  updateRoleCalls: { membershipId: string; role: OrganizationRole }[] = [];

  async create(): Promise<void> {
    throw new Error("not used by team-management use-case tests");
  }

  async findByUserAndOrganization(userId: string): Promise<OrganizationMembership | null> {
    return userId === CALLER_ID ? this.callerMembership : null;
  }

  async findMemberWithUser(): Promise<MembershipWithUser | null> {
    return this.targetEntry;
  }

  async listByOrganization(): Promise<ListOrganizationMembersResult> {
    return this.listResult;
  }

  async countActiveOwners(): Promise<number> {
    return this.activeOwnersCount;
  }

  async updateStatus(
    membershipId: string,
    status: MembershipStatus,
  ): Promise<OrganizationMembership> {
    this.updateStatusCalls.push({ membershipId, status });
    return buildMembership({ id: membershipId, userId: TARGET_USER_ID, status });
  }

  async updateRole(membershipId: string, role: OrganizationRole): Promise<OrganizationMembership> {
    this.updateRoleCalls.push({ membershipId, role });
    return buildMembership({ id: membershipId, userId: TARGET_USER_ID, role });
  }
}
