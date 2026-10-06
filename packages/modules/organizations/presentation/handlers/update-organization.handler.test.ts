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
import { UpdateOrganizationUseCase } from "../../application/use-cases/update-organization.use-case";
import { Organization } from "../../domain/entities/organization";
import type { OrganizationRepository } from "../../domain/repositories/organization-repository";
import { Slug } from "../../domain/value-objects/slug";
import { createUpdateOrganizationHandler } from "./update-organization.handler";

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

  async update(id: string, changes: { displayName: string }): Promise<Organization> {
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

function fakeVerifyOwnerMembership(
  result: Result<void, VerifyOwnerMembershipError>,
): VerifyOwnerMembershipService {
  return async () => result;
}

describe("updateOrganizationHandler", () => {
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
    const useCase = new UpdateOrganizationUseCase(
      organizationRepository,
      verifyOwnerMembership,
      sessionVerifier,
    );
    return createUpdateOrganizationHandler(useCase);
  }

  it("returns 200 with the updated organization for an OWNER caller", async () => {
    const handler = buildHandler(fakeVerifyOwnerMembership(ok(undefined)));

    const response = await handler(
      "Bearer a-valid-access-token",
      { organizationId: ORGANIZATION_ID },
      { display_name: "New Name" },
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        id: ORGANIZATION_ID,
        organization_type: "PARTNER",
        slug: "acme",
        display_name: "New Name",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    });
  });

  it("trims the submitted display_name before persistence", async () => {
    const handler = buildHandler(fakeVerifyOwnerMembership(ok(undefined)));

    const response = await handler(
      "Bearer a-valid-access-token",
      { organizationId: ORGANIZATION_ID },
      { display_name: "  New Name  " },
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ data: { display_name: "New Name" } });
  });

  it("returns 401 UNAUTHORIZED when no Authorization header is present", async () => {
    const handler = buildHandler(fakeVerifyOwnerMembership(ok(undefined)));

    const response = await handler(
      null,
      { organizationId: ORGANIZATION_ID },
      {
        display_name: "New Name",
      },
    );

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ success: false, error: { code: "UNAUTHORIZED" } });
  });

  it("returns 401 UNAUTHORIZED when the access token is invalid or expired", async () => {
    sessionVerifier.result = err({ type: "UNAUTHORIZED" });
    const handler = buildHandler(fakeVerifyOwnerMembership(ok(undefined)));

    const response = await handler(
      "Bearer an-expired-token",
      { organizationId: ORGANIZATION_ID },
      { display_name: "New Name" },
    );

    expect(response.status).toBe(401);
  });

  it("returns 422 VALIDATION_ERROR for a malformed organizationId", async () => {
    const handler = buildHandler(fakeVerifyOwnerMembership(ok(undefined)));

    const response = await handler(
      "Bearer a-valid-access-token",
      { organizationId: "not-a-uuid" },
      { display_name: "New Name" },
    );

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("returns 422 VALIDATION_ERROR for a missing display_name", async () => {
    const handler = buildHandler(fakeVerifyOwnerMembership(ok(undefined)));

    const response = await handler(
      "Bearer a-valid-access-token",
      { organizationId: ORGANIZATION_ID },
      {},
    );

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("returns 422 VALIDATION_ERROR for an empty-string display_name", async () => {
    const handler = buildHandler(fakeVerifyOwnerMembership(ok(undefined)));

    const response = await handler(
      "Bearer a-valid-access-token",
      { organizationId: ORGANIZATION_ID },
      { display_name: "" },
    );

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("returns 422 VALIDATION_ERROR for a whitespace-only display_name", async () => {
    const handler = buildHandler(fakeVerifyOwnerMembership(ok(undefined)));

    const response = await handler(
      "Bearer a-valid-access-token",
      { organizationId: ORGANIZATION_ID },
      { display_name: "   " },
    );

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("returns 403 FORBIDDEN for an ACTIVE ADMIN caller", async () => {
    const handler = buildHandler(fakeVerifyOwnerMembership(err({ type: "NOT_OWNER" })));

    const response = await handler(
      "Bearer a-valid-access-token",
      { organizationId: ORGANIZATION_ID },
      { display_name: "New Name" },
    );

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ success: false, error: { code: "FORBIDDEN" } });
  });

  it("returns 403 FORBIDDEN for an ACTIVE MEMBER caller", async () => {
    const handler = buildHandler(fakeVerifyOwnerMembership(err({ type: "NOT_OWNER" })));

    const response = await handler(
      "Bearer a-valid-access-token",
      { organizationId: ORGANIZATION_ID },
      { display_name: "New Name" },
    );

    expect(response.status).toBe(403);
  });

  it("returns 403 FORBIDDEN for an ACTIVE CLIENT caller", async () => {
    const handler = buildHandler(fakeVerifyOwnerMembership(err({ type: "NOT_OWNER" })));

    const response = await handler(
      "Bearer a-valid-access-token",
      { organizationId: ORGANIZATION_ID },
      { display_name: "New Name" },
    );

    expect(response.status).toBe(403);
  });

  it("returns 500 without leaking details on an unexpected failure", async () => {
    const handler = buildHandler(
      fakeVerifyOwnerMembership(err({ type: "UNEXPECTED", cause: new Error("db down") })),
    );

    const response = await handler(
      "Bearer a-valid-access-token",
      { organizationId: ORGANIZATION_ID },
      { display_name: "New Name" },
    );

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR" },
    });
    expect(JSON.stringify(response.body)).not.toContain("db down");
  });

  it("returns byte-identical 404 responses for nonexistent, no-membership, and SYSTEM-typed organizations", async () => {
    const handlerForNonexistent = buildHandler(
      fakeVerifyOwnerMembership(err({ type: "NOT_ACTIVE_MEMBER" })),
    );
    const responseForNonexistent = await handlerForNonexistent(
      "Bearer a-valid-access-token",
      { organizationId: NONEXISTENT_ID },
      { display_name: "New Name" },
    );

    const handlerForNoMembership = buildHandler(
      fakeVerifyOwnerMembership(err({ type: "NOT_ACTIVE_MEMBER" })),
    );
    const responseForNoMembership = await handlerForNoMembership(
      "Bearer a-valid-access-token",
      { organizationId: ORGANIZATION_ID },
      { display_name: "New Name" },
    );

    const handlerForSystem = buildHandler(fakeVerifyOwnerMembership(ok(undefined)));
    const responseForSystem = await handlerForSystem(
      "Bearer a-valid-access-token",
      { organizationId: SYSTEM_ORGANIZATION_ID },
      { display_name: "New Name" },
    );

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

  it("returns the unchanged OrganizationDto shape (no membership details, no updated_at)", async () => {
    const handler = buildHandler(fakeVerifyOwnerMembership(ok(undefined)));

    const response = await handler(
      "Bearer a-valid-access-token",
      { organizationId: ORGANIZATION_ID },
      { display_name: "New Name" },
    );

    expect(response.status).toBe(200);
    const data = (response.body as { data: Record<string, unknown> }).data;
    expect(Object.keys(data).sort()).toEqual(
      ["id", "organization_type", "slug", "display_name", "created_at"].sort(),
    );
  });
});
