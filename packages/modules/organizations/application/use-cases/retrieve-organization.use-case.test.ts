import { err, ok, type Result } from "@allinvites/kernel";
import type {
  VerifyActiveMembershipError,
  VerifyActiveMembershipParams,
  VerifyActiveMembershipService,
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
import { RetrieveOrganizationUseCase } from "./retrieve-organization.use-case";

const CALLER_ID = "11111111-1111-1111-1111-111111111111";
const ORGANIZATION_ID = "22222222-2222-2222-2222-222222222222";

class FakeOrganizationRepository implements OrganizationRepository {
  organizationsById = new Map<string, Organization>();

  async create(): Promise<void> {
    throw new Error("not used by RetrieveOrganizationUseCase tests");
  }

  async findById(id: string): Promise<Organization | null> {
    return this.organizationsById.get(id) ?? null;
  }

  async findByIds(): Promise<{ items: Organization[]; total: number }> {
    throw new Error("not used by RetrieveOrganizationUseCase tests");
  }
}

class FakeSessionVerifier implements SessionVerifier {
  result: Result<VerifiedCaller, SessionVerifierError> = ok({ userId: CALLER_ID });

  async verify(): Promise<Result<VerifiedCaller, SessionVerifierError>> {
    return this.result;
  }
}

function fakeVerifyActiveMembership(result: Result<void, VerifyActiveMembershipError>): {
  service: VerifyActiveMembershipService;
  calls: VerifyActiveMembershipParams[];
} {
  const calls: VerifyActiveMembershipParams[] = [];
  const service: VerifyActiveMembershipService = async (params) => {
    calls.push(params);
    return result;
  };
  return { service, calls };
}

function organization(id: string = ORGANIZATION_ID): Organization {
  return Organization.fromPersistence({
    id,
    organizationType: "PARTNER",
    slug: Slug.fromPersistence("acme"),
    displayName: "Acme",
    createdAt: new Date(),
  });
}

describe("RetrieveOrganizationUseCase", () => {
  let organizationRepository: FakeOrganizationRepository;
  let sessionVerifier: FakeSessionVerifier;

  beforeEach(() => {
    organizationRepository = new FakeOrganizationRepository();
    sessionVerifier = new FakeSessionVerifier();
  });

  it("returns the organization when the caller has an ACTIVE membership", async () => {
    organizationRepository.organizationsById.set(ORGANIZATION_ID, organization());
    const { service, calls } = fakeVerifyActiveMembership(ok(undefined));
    const useCase = new RetrieveOrganizationUseCase(
      organizationRepository,
      service,
      sessionVerifier,
    );

    const result = await useCase.execute("token", ORGANIZATION_ID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.organization.id).toBe(ORGANIZATION_ID);
    expect(calls).toEqual([{ userId: CALLER_ID, organizationId: ORGANIZATION_ID }]);
  });

  it("accepts any membership role — no OWNER/ADMIN restriction is applied", async () => {
    organizationRepository.organizationsById.set(ORGANIZATION_ID, organization());
    const { service } = fakeVerifyActiveMembership(ok(undefined));
    const useCase = new RetrieveOrganizationUseCase(
      organizationRepository,
      service,
      sessionVerifier,
    );

    const result = await useCase.execute("token", ORGANIZATION_ID);

    expect(result.ok).toBe(true);
  });

  it("returns NOT_FOUND when the caller has no ACTIVE membership in an existing organization", async () => {
    organizationRepository.organizationsById.set(ORGANIZATION_ID, organization());
    const { service } = fakeVerifyActiveMembership(err({ type: "NOT_A_MEMBER" }));
    const useCase = new RetrieveOrganizationUseCase(
      organizationRepository,
      service,
      sessionVerifier,
    );

    const result = await useCase.execute("token", ORGANIZATION_ID);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "NOT_FOUND" });
  });

  it("returns NOT_FOUND for a nonexistent organization id — identical to the inaccessible case", async () => {
    const { service } = fakeVerifyActiveMembership(err({ type: "NOT_A_MEMBER" }));
    const useCase = new RetrieveOrganizationUseCase(
      organizationRepository,
      service,
      sessionVerifier,
    );

    const result = await useCase.execute("token", "99999999-9999-9999-9999-999999999999");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "NOT_FOUND" });
  });

  it("returns NOT_FOUND if membership passes but the organization row is missing (defensive)", async () => {
    const { service } = fakeVerifyActiveMembership(ok(undefined));
    const useCase = new RetrieveOrganizationUseCase(
      organizationRepository,
      service,
      sessionVerifier,
    );

    const result = await useCase.execute("token", ORGANIZATION_ID);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "NOT_FOUND" });
  });

  it("rejects an unauthenticated caller without checking membership or fetching data", async () => {
    sessionVerifier.result = err({ type: "UNAUTHORIZED" });
    const { service, calls } = fakeVerifyActiveMembership(ok(undefined));
    const useCase = new RetrieveOrganizationUseCase(
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
    const { service } = fakeVerifyActiveMembership(ok(undefined));
    const useCase = new RetrieveOrganizationUseCase(
      organizationRepository,
      service,
      sessionVerifier,
    );

    const result = await useCase.execute("token", ORGANIZATION_ID);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });

  it("propagates an unexpected membership-verification failure", async () => {
    const { service } = fakeVerifyActiveMembership(
      err({ type: "UNEXPECTED", cause: new Error("db down") }),
    );
    const useCase = new RetrieveOrganizationUseCase(
      organizationRepository,
      service,
      sessionVerifier,
    );

    const result = await useCase.execute("token", ORGANIZATION_ID);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });

  it("tenancy: a caller with ACTIVE membership in Organization A cannot retrieve Organization B", async () => {
    const ORG_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const ORG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    organizationRepository.organizationsById.set(ORG_A, organization(ORG_A));
    organizationRepository.organizationsById.set(ORG_B, organization(ORG_B));

    const service: VerifyActiveMembershipService = async (params) =>
      params.organizationId === ORG_A ? ok(undefined) : err({ type: "NOT_A_MEMBER" });
    const useCase = new RetrieveOrganizationUseCase(
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
