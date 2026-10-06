import { err, ok, type Result } from "@allinvites/kernel";
import type {
  VerifyActiveMembershipError,
  VerifyActiveMembershipService,
} from "@allinvites/module-identity";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  SessionVerifier,
  SessionVerifierError,
  VerifiedCaller,
} from "../../application/ports/session-verifier";
import { RetrieveOrganizationUseCase } from "../../application/use-cases/retrieve-organization.use-case";
import { Organization } from "../../domain/entities/organization";
import type { OrganizationRepository } from "../../domain/repositories/organization-repository";
import { Slug } from "../../domain/value-objects/slug";
import { createRetrieveOrganizationHandler } from "./retrieve-organization.handler";

const CALLER_ID = "11111111-1111-1111-1111-111111111111";
const ORGANIZATION_ID = "22222222-2222-4222-8222-222222222222";
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
}

class FakeSessionVerifier implements SessionVerifier {
  result: Result<VerifiedCaller, SessionVerifierError> = ok({ userId: CALLER_ID });

  async verify(): Promise<Result<VerifiedCaller, SessionVerifierError>> {
    return this.result;
  }
}

function fakeVerifyActiveMembership(
  result: Result<void, VerifyActiveMembershipError>,
): VerifyActiveMembershipService {
  return async () => result;
}

describe("retrieveOrganizationHandler", () => {
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
    sessionVerifier = new FakeSessionVerifier();
  });

  function buildHandler(verifyActiveMembership: VerifyActiveMembershipService) {
    const useCase = new RetrieveOrganizationUseCase(
      organizationRepository,
      verifyActiveMembership,
      sessionVerifier,
    );
    return createRetrieveOrganizationHandler(useCase);
  }

  it("returns 200 with the organization on success", async () => {
    const handler = buildHandler(fakeVerifyActiveMembership(ok(undefined)));

    const response = await handler("Bearer a-valid-access-token", {
      organizationId: ORGANIZATION_ID,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        id: ORGANIZATION_ID,
        organization_type: "PARTNER",
        slug: "acme",
        display_name: "Acme",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    });
  });

  it("returns 401 UNAUTHORIZED when no Authorization header is present", async () => {
    const handler = buildHandler(fakeVerifyActiveMembership(ok(undefined)));

    const response = await handler(null, { organizationId: ORGANIZATION_ID });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ success: false, error: { code: "UNAUTHORIZED" } });
  });

  it("returns 401 UNAUTHORIZED when the access token is invalid or expired", async () => {
    sessionVerifier.result = err({ type: "UNAUTHORIZED" });
    const handler = buildHandler(fakeVerifyActiveMembership(ok(undefined)));

    const response = await handler("Bearer an-expired-token", { organizationId: ORGANIZATION_ID });

    expect(response.status).toBe(401);
  });

  it("returns 422 VALIDATION_ERROR for a malformed organizationId", async () => {
    const handler = buildHandler(fakeVerifyActiveMembership(ok(undefined)));

    const response = await handler("Bearer a-valid-access-token", { organizationId: "not-a-uuid" });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("returns 500 without leaking details on an unexpected failure", async () => {
    const handler = buildHandler(
      fakeVerifyActiveMembership(err({ type: "UNEXPECTED", cause: new Error("db down") })),
    );

    const response = await handler("Bearer a-valid-access-token", {
      organizationId: ORGANIZATION_ID,
    });

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR" },
    });
    expect(JSON.stringify(response.body)).not.toContain("db down");
  });

  it("returns byte-identical 404 responses for a nonexistent organization and an inaccessible one", async () => {
    const handlerForNonexistent = buildHandler(
      fakeVerifyActiveMembership(err({ type: "NOT_A_MEMBER" })),
    );
    const responseForNonexistent = await handlerForNonexistent("Bearer a-valid-access-token", {
      organizationId: NONEXISTENT_ID,
    });

    const handlerForInaccessible = buildHandler(
      fakeVerifyActiveMembership(err({ type: "NOT_A_MEMBER" })),
    );
    const responseForInaccessible = await handlerForInaccessible("Bearer a-valid-access-token", {
      organizationId: ORGANIZATION_ID,
    });

    expect(responseForNonexistent.status).toBe(404);
    expect(responseForInaccessible.status).toBe(404);
    expect(JSON.stringify(responseForNonexistent.body)).toBe(
      JSON.stringify(responseForInaccessible.body),
    );
    expect(responseForNonexistent.body).toMatchObject({
      success: false,
      error: { code: "RESOURCE_NOT_FOUND" },
    });
  });
});
