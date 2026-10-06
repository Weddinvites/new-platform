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
import { UpdateOrganizationSettingsUseCase } from "./update-organization-settings.use-case";

const CALLER_ID = "11111111-1111-1111-1111-111111111111";
const ORGANIZATION_ID = "22222222-2222-2222-2222-222222222222";

class FakeOrganizationRepository implements OrganizationRepository {
  organizationsById = new Map<string, Organization>();
  updateSettingsCalls: { id: string; changes: { supportContactEmail: string } }[] = [];

  async create(): Promise<void> {
    throw new Error("not used by UpdateOrganizationSettingsUseCase tests");
  }

  async findById(id: string): Promise<Organization | null> {
    return this.organizationsById.get(id) ?? null;
  }

  async findByIds(): Promise<{ items: Organization[]; total: number }> {
    throw new Error("not used by UpdateOrganizationSettingsUseCase tests");
  }

  async update(): Promise<Organization> {
    throw new Error("not used by UpdateOrganizationSettingsUseCase tests");
  }

  async updateBranding(): Promise<Organization> {
    throw new Error("not used by UpdateOrganizationSettingsUseCase tests");
  }

  async updateSettings(
    id: string,
    changes: { supportContactEmail: string },
  ): Promise<Organization> {
    this.updateSettingsCalls.push({ id, changes });
    const existing = this.organizationsById.get(id);
    if (!existing) {
      throw new Error("organization not found");
    }
    const updated = Organization.fromPersistence({
      id: existing.id,
      organizationType: existing.organizationType,
      slug: existing.slug,
      displayName: existing.displayName,
      createdAt: existing.createdAt,
      supportContactEmail: changes.supportContactEmail,
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

describe("UpdateOrganizationSettingsUseCase", () => {
  let organizationRepository: FakeOrganizationRepository;
  let sessionVerifier: FakeSessionVerifier;

  beforeEach(() => {
    organizationRepository = new FakeOrganizationRepository();
    sessionVerifier = new FakeSessionVerifier();
  });

  it("updates support_contact_email for an ACTIVE OWNER caller", async () => {
    organizationRepository.organizationsById.set(ORGANIZATION_ID, organization());
    const { service, calls } = fakeVerifyOwnerMembership(ok(undefined));
    const useCase = new UpdateOrganizationSettingsUseCase(
      organizationRepository,
      service,
      sessionVerifier,
    );

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      supportContactEmail: "support@acme.test",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.organization.supportContactEmail).toBe("support@acme.test");
    expect(calls).toEqual([{ userId: CALLER_ID, organizationId: ORGANIZATION_ID }]);
    expect(organizationRepository.updateSettingsCalls).toEqual([
      { id: ORGANIZATION_ID, changes: { supportContactEmail: "support@acme.test" } },
    ]);
  });

  it("replaces a previously set value with a new one", async () => {
    organizationRepository.organizationsById.set(
      ORGANIZATION_ID,
      Organization.fromPersistence({
        id: ORGANIZATION_ID,
        organizationType: "PARTNER",
        slug: Slug.fromPersistence("acme"),
        displayName: "Acme",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        supportContactEmail: "old@acme.test",
      }),
    );
    const { service } = fakeVerifyOwnerMembership(ok(undefined));
    const useCase = new UpdateOrganizationSettingsUseCase(
      organizationRepository,
      service,
      sessionVerifier,
    );

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      supportContactEmail: "new@acme.test",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.organization.supportContactEmail).toBe("new@acme.test");
  });

  it("returns FORBIDDEN when the caller has an ACTIVE membership but is not OWNER", async () => {
    organizationRepository.organizationsById.set(ORGANIZATION_ID, organization());
    const { service } = fakeVerifyOwnerMembership(err({ type: "NOT_OWNER" }));
    const useCase = new UpdateOrganizationSettingsUseCase(
      organizationRepository,
      service,
      sessionVerifier,
    );

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      supportContactEmail: "support@acme.test",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "FORBIDDEN" });
    expect(organizationRepository.updateSettingsCalls).toHaveLength(0);
  });

  it("returns NOT_FOUND when the caller has no membership at all", async () => {
    organizationRepository.organizationsById.set(ORGANIZATION_ID, organization());
    const { service } = fakeVerifyOwnerMembership(err({ type: "NOT_ACTIVE_MEMBER" }));
    const useCase = new UpdateOrganizationSettingsUseCase(
      organizationRepository,
      service,
      sessionVerifier,
    );

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      supportContactEmail: "support@acme.test",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "NOT_FOUND" });
  });

  it("returns NOT_FOUND for a nonexistent organization id", async () => {
    const { service } = fakeVerifyOwnerMembership(err({ type: "NOT_ACTIVE_MEMBER" }));
    const useCase = new UpdateOrganizationSettingsUseCase(
      organizationRepository,
      service,
      sessionVerifier,
    );

    const result = await useCase.execute("token", {
      organizationId: "99999999-9999-9999-9999-999999999999",
      supportContactEmail: "support@acme.test",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "NOT_FOUND" });
  });

  it("returns NOT_FOUND if ownership passes but the organization row is missing (defensive)", async () => {
    const { service } = fakeVerifyOwnerMembership(ok(undefined));
    const useCase = new UpdateOrganizationSettingsUseCase(
      organizationRepository,
      service,
      sessionVerifier,
    );

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      supportContactEmail: "support@acme.test",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "NOT_FOUND" });
    expect(organizationRepository.updateSettingsCalls).toHaveLength(0);
  });

  it("returns NOT_FOUND (normalized) for a SYSTEM organization", async () => {
    organizationRepository.organizationsById.set(
      ORGANIZATION_ID,
      organization({ organizationType: "SYSTEM" }),
    );
    const { service } = fakeVerifyOwnerMembership(ok(undefined));
    const useCase = new UpdateOrganizationSettingsUseCase(
      organizationRepository,
      service,
      sessionVerifier,
    );

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      supportContactEmail: "support@acme.test",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "NOT_FOUND" });
    expect(organizationRepository.updateSettingsCalls).toHaveLength(0);
  });

  it("rejects an unauthenticated caller without checking ownership or updating data", async () => {
    sessionVerifier.result = err({ type: "UNAUTHORIZED" });
    const { service, calls } = fakeVerifyOwnerMembership(ok(undefined));
    const useCase = new UpdateOrganizationSettingsUseCase(
      organizationRepository,
      service,
      sessionVerifier,
    );

    const result = await useCase.execute("bad-token", {
      organizationId: ORGANIZATION_ID,
      supportContactEmail: "support@acme.test",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "UNAUTHORIZED" });
    expect(calls).toHaveLength(0);
  });

  it("propagates an unexpected session-verification failure distinctly from UNAUTHORIZED", async () => {
    sessionVerifier.result = err({ type: "UNEXPECTED", cause: new Error("network down") });
    const { service } = fakeVerifyOwnerMembership(ok(undefined));
    const useCase = new UpdateOrganizationSettingsUseCase(
      organizationRepository,
      service,
      sessionVerifier,
    );

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      supportContactEmail: "support@acme.test",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });

  it("propagates an unexpected ownership-verification failure", async () => {
    const { service } = fakeVerifyOwnerMembership(
      err({ type: "UNEXPECTED", cause: new Error("db down") }),
    );
    const useCase = new UpdateOrganizationSettingsUseCase(
      organizationRepository,
      service,
      sessionVerifier,
    );

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      supportContactEmail: "support@acme.test",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });

  it("tenancy: an OWNER of Organization A cannot update Organization B's settings", async () => {
    const ORG_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const ORG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    organizationRepository.organizationsById.set(ORG_A, organization({ id: ORG_A }));
    organizationRepository.organizationsById.set(ORG_B, organization({ id: ORG_B }));

    const service: VerifyOwnerMembershipService = async (params) =>
      params.organizationId === ORG_A ? ok(undefined) : err({ type: "NOT_ACTIVE_MEMBER" });
    const useCase = new UpdateOrganizationSettingsUseCase(
      organizationRepository,
      service,
      sessionVerifier,
    );

    const resultA = await useCase.execute("token", {
      organizationId: ORG_A,
      supportContactEmail: "a@acme.test",
    });
    const resultB = await useCase.execute("token", {
      organizationId: ORG_B,
      supportContactEmail: "b@acme.test",
    });

    expect(resultA.ok).toBe(true);
    expect(resultB.ok).toBe(false);
    if (resultB.ok) return;
    expect(resultB.error).toEqual({ type: "NOT_FOUND" });
  });
});
