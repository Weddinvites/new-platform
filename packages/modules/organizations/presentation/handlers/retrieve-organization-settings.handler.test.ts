import { err, ok, type Result } from "@allinvites/kernel";
import type {
  VerifyOwnerMembershipError,
  VerifyOwnerMembershipService,
} from "@allinvites/module-identity";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  SessionVerifier,
  SessionVerifierError,
  VerifiedCaller,
} from "../../application/ports/session-verifier";
import { RetrieveOrganizationSettingsUseCase } from "../../application/use-cases/retrieve-organization-settings.use-case";
import { Organization } from "../../domain/entities/organization";
import type { OrganizationRepository } from "../../domain/repositories/organization-repository";
import { Slug } from "../../domain/value-objects/slug";
import { createRetrieveOrganizationSettingsHandler } from "./retrieve-organization-settings.handler";

const CALLER_ID = "11111111-1111-4111-8111-111111111111";
const ORGANIZATION_ID = "22222222-2222-4222-8222-222222222222";
const SYSTEM_ORGANIZATION_ID = "33333333-3333-4333-8333-333333333333";
const NONEXISTENT_ID = "99999999-9999-4999-8999-999999999999";

class FakeOrganizationRepository implements OrganizationRepository {
  organizationsById = new Map<string, Organization>();

  async create(): Promise<void> {
    throw new Error("not used");
  }

  async findById(id: string): Promise<Organization | null> {
    return this.organizationsById.get(id) ?? null;
  }

  async findByIds(): Promise<{ items: Organization[]; total: number }> {
    throw new Error("not used");
  }

  async update(): Promise<Organization> {
    throw new Error("not used");
  }

  async updateBranding(): Promise<Organization> {
    throw new Error("not used");
  }

  async updateSettings(): Promise<Organization> {
    throw new Error("not used");
  }
}

class FakeSessionVerifier implements SessionVerifier {
  result: Result<VerifiedCaller, SessionVerifierError> = ok({ userId: CALLER_ID });

  async verify(): Promise<Result<VerifiedCaller, SessionVerifierError>> {
    return this.result;
  }
}

function fakeVerifyOwnerMembership(
  result: Result<void, VerifyOwnerMembershipError>,
): VerifyOwnerMembershipService {
  return async () => result;
}

describe("retrieveOrganizationSettingsHandler", () => {
  let organizationRepository: FakeOrganizationRepository;
  let sessionVerifier: FakeSessionVerifier;

  beforeEach(() => {
    organizationRepository = new FakeOrganizationRepository();
    organizationRepository.organizationsById.set(
      ORGANIZATION_ID,
      Organization.fromPersistence({
        id: ORGANIZATION_ID,
        organizationType: "PARTNER",
        slug: Slug.fromPersistence("acme"),
        displayName: "Acme",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        supportContactEmail: "support@acme.test",
      }),
    );
    organizationRepository.organizationsById.set(
      SYSTEM_ORGANIZATION_ID,
      Organization.fromPersistence({
        id: SYSTEM_ORGANIZATION_ID,
        organizationType: "SYSTEM",
        slug: Slug.fromPersistence("system"),
        displayName: "System",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    );
    sessionVerifier = new FakeSessionVerifier();
  });

  function buildHandler(verifyOwnerMembership: VerifyOwnerMembershipService) {
    const useCase = new RetrieveOrganizationSettingsUseCase(
      organizationRepository,
      verifyOwnerMembership,
      sessionVerifier,
    );
    return createRetrieveOrganizationSettingsHandler(useCase);
  }

  it("returns 200 with the organization's settings for an OWNER caller", async () => {
    const handler = buildHandler(fakeVerifyOwnerMembership(ok(undefined)));

    const response = await handler("Bearer a-valid-access-token", {
      organizationId: ORGANIZATION_ID,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        organization_id: ORGANIZATION_ID,
        support_contact_email: "support@acme.test",
      },
    });
  });

  it("returns null when support_contact_email has not been configured", async () => {
    organizationRepository.organizationsById.set(
      ORGANIZATION_ID,
      Organization.fromPersistence({
        id: ORGANIZATION_ID,
        organizationType: "PARTNER",
        slug: Slug.fromPersistence("acme"),
        displayName: "Acme",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    );
    const handler = buildHandler(fakeVerifyOwnerMembership(ok(undefined)));

    const response = await handler("Bearer a-valid-access-token", {
      organizationId: ORGANIZATION_ID,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        organization_id: ORGANIZATION_ID,
        support_contact_email: null,
      },
    });
  });

  it("returns 401 UNAUTHORIZED when no Authorization header is present", async () => {
    const handler = buildHandler(fakeVerifyOwnerMembership(ok(undefined)));

    const response = await handler(null, { organizationId: ORGANIZATION_ID });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ success: false, error: { code: "UNAUTHORIZED" } });
  });

  it("returns 422 VALIDATION_ERROR for a malformed organizationId", async () => {
    const handler = buildHandler(fakeVerifyOwnerMembership(ok(undefined)));

    const response = await handler("Bearer a-valid-access-token", { organizationId: "not-a-uuid" });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("returns 403 FORBIDDEN for an ACTIVE non-OWNER caller", async () => {
    const handler = buildHandler(fakeVerifyOwnerMembership(err({ type: "NOT_OWNER" })));

    const response = await handler("Bearer a-valid-access-token", {
      organizationId: ORGANIZATION_ID,
    });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ success: false, error: { code: "FORBIDDEN" } });
  });

  it("returns 500 without leaking details on an unexpected failure", async () => {
    const handler = buildHandler(
      fakeVerifyOwnerMembership(err({ type: "UNEXPECTED", cause: new Error("db down") })),
    );

    const response = await handler("Bearer a-valid-access-token", {
      organizationId: ORGANIZATION_ID,
    });

    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain("db down");
  });

  it("returns byte-identical 404 responses for nonexistent, no-membership, and SYSTEM-typed organizations", async () => {
    const handlerForNonexistent = buildHandler(
      fakeVerifyOwnerMembership(err({ type: "NOT_ACTIVE_MEMBER" })),
    );
    const responseForNonexistent = await handlerForNonexistent("Bearer a-valid-access-token", {
      organizationId: NONEXISTENT_ID,
    });

    const handlerForNoMembership = buildHandler(
      fakeVerifyOwnerMembership(err({ type: "NOT_ACTIVE_MEMBER" })),
    );
    const responseForNoMembership = await handlerForNoMembership("Bearer a-valid-access-token", {
      organizationId: ORGANIZATION_ID,
    });

    const handlerForSystem = buildHandler(fakeVerifyOwnerMembership(ok(undefined)));
    const responseForSystem = await handlerForSystem("Bearer a-valid-access-token", {
      organizationId: SYSTEM_ORGANIZATION_ID,
    });

    expect(responseForNonexistent.status).toBe(404);
    expect(responseForNoMembership.status).toBe(404);
    expect(responseForSystem.status).toBe(404);
    expect(JSON.stringify(responseForNonexistent.body)).toBe(
      JSON.stringify(responseForNoMembership.body),
    );
    expect(JSON.stringify(responseForNoMembership.body)).toBe(
      JSON.stringify(responseForSystem.body),
    );
    expect(responseForNonexistent.body).toMatchObject({
      success: false,
      error: { code: "RESOURCE_NOT_FOUND" },
    });
  });
});
