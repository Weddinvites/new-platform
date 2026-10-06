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
import { RetrieveOrganizationBrandingUseCase } from "./retrieve-organization-branding.use-case";

const CALLER_ID = "11111111-1111-1111-1111-111111111111";
const ORGANIZATION_ID = "22222222-2222-2222-2222-222222222222";

class FakeOrganizationRepository implements OrganizationRepository {
  organizationsById = new Map<string, Organization>();

  async create(): Promise<void> {
    throw new Error("not used by RetrieveOrganizationBrandingUseCase tests");
  }

  async findById(id: string): Promise<Organization | null> {
    return this.organizationsById.get(id) ?? null;
  }

  async findByIds(): Promise<{ items: Organization[]; total: number }> {
    throw new Error("not used by RetrieveOrganizationBrandingUseCase tests");
  }

  async update(): Promise<Organization> {
    throw new Error("not used by RetrieveOrganizationBrandingUseCase tests");
  }

  async updateBranding(): Promise<Organization> {
    throw new Error("not used by RetrieveOrganizationBrandingUseCase tests");
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
    brandName: "Acme Weddings",
    logo: "https://cdn.example.com/logo.png",
    primaryColor: "#112233",
    secondaryColor: "#445566",
  });
}

describe("RetrieveOrganizationBrandingUseCase", () => {
  let organizationRepository: FakeOrganizationRepository;
  let sessionVerifier: FakeSessionVerifier;

  beforeEach(() => {
    organizationRepository = new FakeOrganizationRepository();
    sessionVerifier = new FakeSessionVerifier();
  });

  it("returns the organization's branding for an ACTIVE OWNER caller", async () => {
    organizationRepository.organizationsById.set(ORGANIZATION_ID, organization());
    const { service, calls } = fakeVerifyOwnerMembership(ok(undefined));
    const useCase = new RetrieveOrganizationBrandingUseCase(
      organizationRepository,
      service,
      sessionVerifier,
    );

    const result = await useCase.execute("token", ORGANIZATION_ID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.organization.brandName).toBe("Acme Weddings");
    expect(calls).toEqual([{ userId: CALLER_ID, organizationId: ORGANIZATION_ID }]);
  });

  it("returns FORBIDDEN when the caller has an ACTIVE membership but is not OWNER", async () => {
    organizationRepository.organizationsById.set(ORGANIZATION_ID, organization());
    const { service } = fakeVerifyOwnerMembership(err({ type: "NOT_OWNER" }));
    const useCase = new RetrieveOrganizationBrandingUseCase(
      organizationRepository,
      service,
      sessionVerifier,
    );

    const result = await useCase.execute("token", ORGANIZATION_ID);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "FORBIDDEN" });
  });

  it("returns NOT_FOUND when the caller has no membership at all", async () => {
    organizationRepository.organizationsById.set(ORGANIZATION_ID, organization());
    const { service } = fakeVerifyOwnerMembership(err({ type: "NOT_ACTIVE_MEMBER" }));
    const useCase = new RetrieveOrganizationBrandingUseCase(
      organizationRepository,
      service,
      sessionVerifier,
    );

    const result = await useCase.execute("token", ORGANIZATION_ID);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "NOT_FOUND" });
  });

  it("returns NOT_FOUND for a nonexistent organization id", async () => {
    const { service } = fakeVerifyOwnerMembership(err({ type: "NOT_ACTIVE_MEMBER" }));
    const useCase = new RetrieveOrganizationBrandingUseCase(
      organizationRepository,
      service,
      sessionVerifier,
    );

    const result = await useCase.execute("token", "99999999-9999-9999-9999-999999999999");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "NOT_FOUND" });
  });

  it("returns NOT_FOUND if ownership passes but the organization row is missing (defensive)", async () => {
    const { service } = fakeVerifyOwnerMembership(ok(undefined));
    const useCase = new RetrieveOrganizationBrandingUseCase(
      organizationRepository,
      service,
      sessionVerifier,
    );

    const result = await useCase.execute("token", ORGANIZATION_ID);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "NOT_FOUND" });
  });

  it("returns NOT_FOUND (normalized) for a SYSTEM organization", async () => {
    organizationRepository.organizationsById.set(
      ORGANIZATION_ID,
      organization({ organizationType: "SYSTEM" }),
    );
    const { service } = fakeVerifyOwnerMembership(ok(undefined));
    const useCase = new RetrieveOrganizationBrandingUseCase(
      organizationRepository,
      service,
      sessionVerifier,
    );

    const result = await useCase.execute("token", ORGANIZATION_ID);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "NOT_FOUND" });
  });

  it("rejects an unauthenticated caller without checking ownership or fetching data", async () => {
    sessionVerifier.result = err({ type: "UNAUTHORIZED" });
    const { service, calls } = fakeVerifyOwnerMembership(ok(undefined));
    const useCase = new RetrieveOrganizationBrandingUseCase(
      organizationRepository,
      service,
      sessionVerifier,
    );

    const result = await useCase.execute("bad-token", ORGANIZATION_ID);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "UNAUTHORIZED" });
    expect(calls).toHaveLength(0);
  });

  it("propagates an unexpected session-verification failure distinctly from UNAUTHORIZED", async () => {
    sessionVerifier.result = err({ type: "UNEXPECTED", cause: new Error("network down") });
    const { service } = fakeVerifyOwnerMembership(ok(undefined));
    const useCase = new RetrieveOrganizationBrandingUseCase(
      organizationRepository,
      service,
      sessionVerifier,
    );

    const result = await useCase.execute("token", ORGANIZATION_ID);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });

  it("propagates an unexpected ownership-verification failure", async () => {
    const { service } = fakeVerifyOwnerMembership(
      err({ type: "UNEXPECTED", cause: new Error("db down") }),
    );
    const useCase = new RetrieveOrganizationBrandingUseCase(
      organizationRepository,
      service,
      sessionVerifier,
    );

    const result = await useCase.execute("token", ORGANIZATION_ID);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });

  it("tenancy: an OWNER of Organization A cannot retrieve Organization B's branding", async () => {
    const ORG_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const ORG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    organizationRepository.organizationsById.set(ORG_A, organization({ id: ORG_A }));
    organizationRepository.organizationsById.set(ORG_B, organization({ id: ORG_B }));

    const service: VerifyOwnerMembershipService = async (params) =>
      params.organizationId === ORG_A ? ok(undefined) : err({ type: "NOT_ACTIVE_MEMBER" });
    const useCase = new RetrieveOrganizationBrandingUseCase(
      organizationRepository,
      service,
      sessionVerifier,
    );

    const resultA = await useCase.execute("token", ORG_A);
    const resultB = await useCase.execute("token", ORG_B);

    expect(resultA.ok).toBe(true);
    expect(resultB.ok).toBe(false);
    if (resultB.ok) return;
    expect(resultB.error).toEqual({ type: "NOT_FOUND" });
  });
});
