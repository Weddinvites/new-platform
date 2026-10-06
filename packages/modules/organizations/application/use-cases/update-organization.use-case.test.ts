import { err, ok, type Result } from "@allinvites/kernel";
import type {
  VerifyOwnerMembershipError,
  VerifyOwnerMembershipParams,
  VerifyOwnerMembershipService,
} from "@allinvites/module-identity";
import { beforeEach, describe, expect, it } from "vitest";
import { Organization } from "../../domain/entities/organization";
import type { OrganizationRepository } from "../../domain/repositories/organization-repository";
import { Slug } from "../../domain/value-objects/slug";
import type {
  SessionVerifier,
  SessionVerifierError,
  VerifiedCaller,
} from "../ports/session-verifier";
import { UpdateOrganizationUseCase } from "./update-organization.use-case";

const CALLER_ID = "11111111-1111-1111-1111-111111111111";
const ORGANIZATION_ID = "22222222-2222-2222-2222-222222222222";

class FakeOrganizationRepository implements OrganizationRepository {
  organizationsById = new Map<string, Organization>();
  updateCalls: { id: string; changes: { displayName: string } }[] = [];

  async create(): Promise<void> {
    throw new Error("not used by UpdateOrganizationUseCase tests");
  }

  async findById(id: string): Promise<Organization | null> {
    return this.organizationsById.get(id) ?? null;
  }

  async findByIds(): Promise<{ items: Organization[]; total: number }> {
    throw new Error("not used by UpdateOrganizationUseCase tests");
  }

  async update(id: string, changes: { displayName: string }): Promise<Organization> {
    this.updateCalls.push({ id, changes });
    const existing = this.organizationsById.get(id);
    if (!existing) {
      throw new Error("organization not found");
    }
    const updated = Organization.fromPersistence({
      id: existing.id,
      organizationType: existing.organizationType,
      slug: existing.slug,
      displayName: changes.displayName,
      createdAt: existing.createdAt,
    });
    this.organizationsById.set(id, updated);
    return updated;
  }
}

class FakeSessionVerifier implements SessionVerifier {
  result: Result<VerifiedCaller, SessionVerifierError> = ok({ userId: CALLER_ID });

  async verify(): Promise<Result<VerifiedCaller, SessionVerifierError>> {
    return this.result;
  }
}

function fakeVerifyOwnerMembership(result: Result<void, VerifyOwnerMembershipError>): {
  service: VerifyOwnerMembershipService;
  calls: VerifyOwnerMembershipParams[];
} {
  const calls: VerifyOwnerMembershipParams[] = [];
  const service: VerifyOwnerMembershipService = async (params) => {
    calls.push(params);
    return result;
  };
  return { service, calls };
}

function organization(
  overrides: Partial<{ id: string; organizationType: "SYSTEM" | "PARTNER" }> = {},
): Organization {
  return Organization.fromPersistence({
    id: overrides.id ?? ORGANIZATION_ID,
    organizationType: overrides.organizationType ?? "PARTNER",
    slug: Slug.fromPersistence("acme"),
    displayName: "Acme",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  });
}

describe("UpdateOrganizationUseCase", () => {
  let organizationRepository: FakeOrganizationRepository;
  let sessionVerifier: FakeSessionVerifier;

  beforeEach(() => {
    organizationRepository = new FakeOrganizationRepository();
    sessionVerifier = new FakeSessionVerifier();
  });

  it("updates display_name for an ACTIVE OWNER caller", async () => {
    organizationRepository.organizationsById.set(ORGANIZATION_ID, organization());
    const { service, calls } = fakeVerifyOwnerMembership(ok(undefined));
    const useCase = new UpdateOrganizationUseCase(organizationRepository, service, sessionVerifier);

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      displayName: "New Name",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.organization.displayName).toBe("New Name");
    expect(calls).toEqual([{ userId: CALLER_ID, organizationId: ORGANIZATION_ID }]);
    expect(organizationRepository.updateCalls).toEqual([
      { id: ORGANIZATION_ID, changes: { displayName: "New Name" } },
    ]);
  });

  it("preserves id, organization_type, slug, and created_at — only display_name changes", async () => {
    const original = organization();
    organizationRepository.organizationsById.set(ORGANIZATION_ID, original);
    const { service } = fakeVerifyOwnerMembership(ok(undefined));
    const useCase = new UpdateOrganizationUseCase(organizationRepository, service, sessionVerifier);

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      displayName: "New Name",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.organization.id).toBe(original.id);
    expect(result.value.organization.organizationType).toBe(original.organizationType);
    expect(result.value.organization.slug.value).toBe(original.slug.value);
    expect(result.value.organization.createdAt).toEqual(original.createdAt);
  });

  it("returns FORBIDDEN when the caller has an ACTIVE membership but is not OWNER", async () => {
    organizationRepository.organizationsById.set(ORGANIZATION_ID, organization());
    const { service } = fakeVerifyOwnerMembership(err({ type: "NOT_OWNER" }));
    const useCase = new UpdateOrganizationUseCase(organizationRepository, service, sessionVerifier);

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      displayName: "New Name",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "FORBIDDEN" });
    expect(organizationRepository.updateCalls).toHaveLength(0);
  });

  it("returns NOT_FOUND when the caller has no membership at all", async () => {
    organizationRepository.organizationsById.set(ORGANIZATION_ID, organization());
    const { service } = fakeVerifyOwnerMembership(err({ type: "NOT_ACTIVE_MEMBER" }));
    const useCase = new UpdateOrganizationUseCase(organizationRepository, service, sessionVerifier);

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      displayName: "New Name",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "NOT_FOUND" });
  });

  it("returns NOT_FOUND when the caller's membership is SUSPENDED (reported as NOT_ACTIVE_MEMBER)", async () => {
    organizationRepository.organizationsById.set(ORGANIZATION_ID, organization());
    const { service } = fakeVerifyOwnerMembership(err({ type: "NOT_ACTIVE_MEMBER" }));
    const useCase = new UpdateOrganizationUseCase(organizationRepository, service, sessionVerifier);

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      displayName: "New Name",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "NOT_FOUND" });
  });

  it("returns NOT_FOUND for a nonexistent organization id", async () => {
    const { service } = fakeVerifyOwnerMembership(err({ type: "NOT_ACTIVE_MEMBER" }));
    const useCase = new UpdateOrganizationUseCase(organizationRepository, service, sessionVerifier);

    const result = await useCase.execute("token", {
      organizationId: "99999999-9999-9999-9999-999999999999",
      displayName: "New Name",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "NOT_FOUND" });
  });

  it("returns NOT_FOUND if ownership passes but the organization row is missing (defensive)", async () => {
    const { service } = fakeVerifyOwnerMembership(ok(undefined));
    const useCase = new UpdateOrganizationUseCase(organizationRepository, service, sessionVerifier);

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      displayName: "New Name",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "NOT_FOUND" });
    expect(organizationRepository.updateCalls).toHaveLength(0);
  });

  it("returns NOT_FOUND (normalized, not a distinguishable error) for a SYSTEM organization", async () => {
    organizationRepository.organizationsById.set(
      ORGANIZATION_ID,
      organization({ organizationType: "SYSTEM" }),
    );
    const { service } = fakeVerifyOwnerMembership(ok(undefined));
    const useCase = new UpdateOrganizationUseCase(organizationRepository, service, sessionVerifier);

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      displayName: "New Name",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "NOT_FOUND" });
    expect(organizationRepository.updateCalls).toHaveLength(0);
  });

  it("rejects an unauthenticated caller without checking ownership or updating data", async () => {
    sessionVerifier.result = err({ type: "UNAUTHORIZED" });
    const { service, calls } = fakeVerifyOwnerMembership(ok(undefined));
    const useCase = new UpdateOrganizationUseCase(organizationRepository, service, sessionVerifier);

    const result = await useCase.execute("bad-token", {
      organizationId: ORGANIZATION_ID,
      displayName: "New Name",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "UNAUTHORIZED" });
    expect(calls).toHaveLength(0);
  });

  it("propagates an unexpected session-verification failure distinctly from UNAUTHORIZED", async () => {
    sessionVerifier.result = err({ type: "UNEXPECTED", cause: new Error("network down") });
    const { service } = fakeVerifyOwnerMembership(ok(undefined));
    const useCase = new UpdateOrganizationUseCase(organizationRepository, service, sessionVerifier);

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      displayName: "New Name",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });

  it("propagates an unexpected ownership-verification failure", async () => {
    const { service } = fakeVerifyOwnerMembership(
      err({ type: "UNEXPECTED", cause: new Error("db down") }),
    );
    const useCase = new UpdateOrganizationUseCase(organizationRepository, service, sessionVerifier);

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      displayName: "New Name",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });

  it("tenancy: an OWNER of Organization A cannot update Organization B", async () => {
    const ORG_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const ORG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    organizationRepository.organizationsById.set(ORG_A, organization({ id: ORG_A }));
    organizationRepository.organizationsById.set(ORG_B, organization({ id: ORG_B }));

    const service: VerifyOwnerMembershipService = async (params) =>
      params.organizationId === ORG_A ? ok(undefined) : err({ type: "NOT_ACTIVE_MEMBER" });
    const useCase = new UpdateOrganizationUseCase(organizationRepository, service, sessionVerifier);

    const resultA = await useCase.execute("token", {
      organizationId: ORG_A,
      displayName: "New Name",
    });
    const resultB = await useCase.execute("token", {
      organizationId: ORG_B,
      displayName: "New Name",
    });

    expect(resultA.ok).toBe(true);
    expect(resultB.ok).toBe(false);
    if (resultB.ok) return;
    expect(resultB.error).toEqual({ type: "NOT_FOUND" });
  });
});
