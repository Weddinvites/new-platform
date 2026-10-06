import { err, ok, type Result } from "@allinvites/kernel";
import { beforeEach, describe, expect, it } from "vitest";
import { OrganizationMembership } from "../../domain/entities/organization-membership";
import type {
  ListOrganizationMembersResult,
  MembershipWithUser,
  OrganizationMembershipRepository,
} from "../../domain/repositories/organization-membership-repository";
import type { MembershipStatus } from "../../domain/value-objects/membership-status";
import type { OrganizationRole } from "../../domain/value-objects/organization-role";
import type { CreatedAuthUser } from "../ports/auth-provider";
import type { SessionError, SessionProvider, VerifiedIdentity } from "../ports/session-provider";
import { resolveOrganizationContext } from "./resolve-organization-context";

const CALLER_ID = "11111111-1111-1111-1111-111111111111";
const ORGANIZATION_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ORGANIZATION_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

class FakeSessionProvider implements SessionProvider {
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
 * Keyed by organizationId, distinct from STORY-002-007's shared
 * team-management-test-fakes.ts (which only models a single organization
 * per test) — STORY-002-008's own acceptance criteria specifically require
 * proving a caller's context resolves independently per organization.
 */
class FakeMultiOrgMembershipRepository implements OrganizationMembershipRepository {
  private readonly membershipsByOrg = new Map<string, OrganizationMembership>();

  setMembership(organizationId: string, membership: OrganizationMembership): void {
    this.membershipsByOrg.set(organizationId, membership);
  }

  async create(): Promise<void> {
    throw new Error("not used by resolveOrganizationContext tests");
  }

  async findByUserAndOrganization(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationMembership | null> {
    const membership = this.membershipsByOrg.get(organizationId);
    return membership && membership.userId === userId ? membership : null;
  }

  async findMemberWithUser(): Promise<MembershipWithUser | null> {
    throw new Error("not used by resolveOrganizationContext tests");
  }

  async listByOrganization(): Promise<ListOrganizationMembersResult> {
    throw new Error("not used by resolveOrganizationContext tests");
  }

  async countActiveOwners(): Promise<number> {
    throw new Error("not used by resolveOrganizationContext tests");
  }

  async updateStatus(): Promise<OrganizationMembership> {
    throw new Error("not used by resolveOrganizationContext tests");
  }

  async updateRole(): Promise<OrganizationMembership> {
    throw new Error("not used by resolveOrganizationContext tests");
  }
}

function membership(params: {
  organizationId: string;
  role: OrganizationRole;
  status?: MembershipStatus;
}): OrganizationMembership {
  return OrganizationMembership.create({
    id: `membership-${params.organizationId}`,
    userId: CALLER_ID,
    organizationId: params.organizationId,
    role: params.role,
    status: params.status ?? "ACTIVE",
  });
}

describe("resolveOrganizationContext", () => {
  let sessionProvider: FakeSessionProvider;
  let membershipRepository: FakeMultiOrgMembershipRepository;

  beforeEach(() => {
    sessionProvider = new FakeSessionProvider();
    membershipRepository = new FakeMultiOrgMembershipRepository();
  });

  it("resolves context A when the caller has an ACTIVE membership in organization A", async () => {
    membershipRepository.setMembership(
      ORGANIZATION_A,
      membership({ organizationId: ORGANIZATION_A, role: "OWNER" }),
    );

    const result = await resolveOrganizationContext({
      sessionProvider,
      membershipRepository,
      accessToken: "token",
      organizationId: ORGANIZATION_A,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.organizationId).toBe(ORGANIZATION_A);
    expect(result.value.role).toBe("OWNER");
  });

  it("resolves context B for the same caller when organization B is supplied, independent of context A", async () => {
    membershipRepository.setMembership(
      ORGANIZATION_A,
      membership({ organizationId: ORGANIZATION_A, role: "OWNER" }),
    );
    membershipRepository.setMembership(
      ORGANIZATION_B,
      membership({ organizationId: ORGANIZATION_B, role: "MEMBER" }),
    );

    const resultA = await resolveOrganizationContext({
      sessionProvider,
      membershipRepository,
      accessToken: "token",
      organizationId: ORGANIZATION_A,
    });
    const resultB = await resolveOrganizationContext({
      sessionProvider,
      membershipRepository,
      accessToken: "token",
      organizationId: ORGANIZATION_B,
    });

    expect(resultA.ok).toBe(true);
    expect(resultB.ok).toBe(true);
    if (!resultA.ok || !resultB.ok) return;
    expect(resultA.value.organizationId).toBe(ORGANIZATION_A);
    expect(resultA.value.role).toBe("OWNER");
    expect(resultB.value.organizationId).toBe(ORGANIZATION_B);
    expect(resultB.value.role).toBe("MEMBER");
  });

  it("denies context A when the caller only holds membership in organization B (no cross-organization access)", async () => {
    membershipRepository.setMembership(
      ORGANIZATION_B,
      membership({ organizationId: ORGANIZATION_B, role: "MEMBER" }),
    );

    const result = await resolveOrganizationContext({
      sessionProvider,
      membershipRepository,
      accessToken: "token",
      organizationId: ORGANIZATION_A,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "FORBIDDEN" });
  });

  it("denies context resolution when the caller has no membership at all in the requested organization", async () => {
    const result = await resolveOrganizationContext({
      sessionProvider,
      membershipRepository,
      accessToken: "token",
      organizationId: ORGANIZATION_A,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "FORBIDDEN" });
  });

  it("denies context resolution when the membership is SUSPENDED", async () => {
    membershipRepository.setMembership(
      ORGANIZATION_A,
      membership({ organizationId: ORGANIZATION_A, role: "OWNER", status: "SUSPENDED" }),
    );

    const result = await resolveOrganizationContext({
      sessionProvider,
      membershipRepository,
      accessToken: "token",
      organizationId: ORGANIZATION_A,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "FORBIDDEN" });
  });

  it("denies context resolution when the membership is REMOVED", async () => {
    membershipRepository.setMembership(
      ORGANIZATION_A,
      membership({ organizationId: ORGANIZATION_A, role: "OWNER", status: "REMOVED" }),
    );

    const result = await resolveOrganizationContext({
      sessionProvider,
      membershipRepository,
      accessToken: "token",
      organizationId: ORGANIZATION_A,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "FORBIDDEN" });
  });

  it("returns UNAUTHORIZED for a missing/invalid session, before any membership lookup", async () => {
    sessionProvider.identityResult = err({ type: "UNAUTHORIZED" });

    const result = await resolveOrganizationContext({
      sessionProvider,
      membershipRepository,
      accessToken: "token",
      organizationId: ORGANIZATION_A,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "UNAUTHORIZED" });
  });

  it("propagates an unexpected session-verification failure distinctly from UNAUTHORIZED", async () => {
    sessionProvider.identityResult = err({ type: "UNEXPECTED", cause: new Error("network down") });

    const result = await resolveOrganizationContext({
      sessionProvider,
      membershipRepository,
      accessToken: "token",
      organizationId: ORGANIZATION_A,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });

  it("preserves the correct organization_id and role on the resolved context", async () => {
    membershipRepository.setMembership(
      ORGANIZATION_A,
      membership({ organizationId: ORGANIZATION_A, role: "ADMIN" }),
    );

    const result = await resolveOrganizationContext({
      sessionProvider,
      membershipRepository,
      accessToken: "token",
      organizationId: ORGANIZATION_A,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.organizationId).toBe(ORGANIZATION_A);
    expect(result.value.role).toBe("ADMIN");
  });

  it("is request-scoped: resolving context A does not grant or leak into an independent later call for context B", async () => {
    membershipRepository.setMembership(
      ORGANIZATION_A,
      membership({ organizationId: ORGANIZATION_A, role: "OWNER" }),
    );

    const first = await resolveOrganizationContext({
      sessionProvider,
      membershipRepository,
      accessToken: "token",
      organizationId: ORGANIZATION_A,
    });
    expect(first.ok).toBe(true);

    // Nothing is remembered between calls — a later call for a DIFFERENT
    // organization the caller has no membership in must still be denied,
    // exactly as if the first call had never happened.
    const second = await resolveOrganizationContext({
      sessionProvider,
      membershipRepository,
      accessToken: "token",
      organizationId: ORGANIZATION_B,
    });

    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error).toEqual({ type: "FORBIDDEN" });
  });
});
