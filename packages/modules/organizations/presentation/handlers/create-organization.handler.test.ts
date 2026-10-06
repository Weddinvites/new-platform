import type { Database, Transaction } from "@allinvites/database";
import { err, ok, type Result } from "@allinvites/kernel";
import type {
  CreateInitialOwnerMembershipError,
  CreateInitialOwnerMembershipResult,
  CreateInitialOwnerMembershipService,
} from "@allinvites/module-identity";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  SessionVerifier,
  SessionVerifierError,
  VerifiedCaller,
} from "../../application/ports/session-verifier";
import { CreateOrganizationUseCase } from "../../application/use-cases/create-organization.use-case";
import type { Organization } from "../../domain/entities/organization";
import type { OrganizationRepository } from "../../domain/repositories/organization-repository";
import { createCreateOrganizationHandler } from "./create-organization.handler";

const CALLER_ID = "11111111-1111-1111-1111-111111111111";

class FakeOrganizationRepository implements OrganizationRepository {
  created: Organization[] = [];
  failure: unknown;

  async create(organization: Organization): Promise<void> {
    if (this.failure) {
      throw this.failure;
    }
    this.created.push(organization);
  }

  async findById(): Promise<Organization | null> {
    throw new Error("not used");
  }
}

class FakeSessionVerifier implements SessionVerifier {
  result: Result<VerifiedCaller, SessionVerifierError> = ok({ userId: CALLER_ID });

  async verify(): Promise<Result<VerifiedCaller, SessionVerifierError>> {
    return this.result;
  }
}

class FakeDatabase {
  async transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
    return fn({} as Transaction);
  }
}

function createInitialOwnerMembershipReturning(
  result: Result<CreateInitialOwnerMembershipResult, CreateInitialOwnerMembershipError>,
): CreateInitialOwnerMembershipService {
  return async () => result;
}

describe("createOrganizationHandler", () => {
  let handler: ReturnType<typeof createCreateOrganizationHandler>;
  let organizationRepository: FakeOrganizationRepository;
  let sessionVerifier: FakeSessionVerifier;

  beforeEach(() => {
    organizationRepository = new FakeOrganizationRepository();
    sessionVerifier = new FakeSessionVerifier();
    const useCase = new CreateOrganizationUseCase(
      organizationRepository,
      createInitialOwnerMembershipReturning(ok({ membershipId: "membership-1" })),
      sessionVerifier,
      new FakeDatabase() as unknown as Database,
    );
    handler = createCreateOrganizationHandler(useCase);
  });

  it("returns 201 with the created organization and its OWNER membership on success", async () => {
    const response = await handler("Bearer a-valid-access-token", {
      display_name: "Acme Weddings",
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        organization_type: "PARTNER",
        slug: "acme-weddings",
        display_name: "Acme Weddings",
        membership: { role: "OWNER", status: "ACTIVE" },
      },
    });
  });

  it("returns 401 UNAUTHORIZED when no Authorization header is present", async () => {
    const response = await handler(null, { display_name: "Acme Weddings" });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ success: false, error: { code: "UNAUTHORIZED" } });
    expect(organizationRepository.created).toHaveLength(0);
  });

  it("returns 401 UNAUTHORIZED for a malformed Authorization header", async () => {
    const response = await handler("not-a-bearer-token", { display_name: "Acme Weddings" });

    expect(response.status).toBe(401);
  });

  it("returns 401 UNAUTHORIZED when the access token is invalid or expired", async () => {
    sessionVerifier.result = err({ type: "UNAUTHORIZED" });

    const response = await handler("Bearer an-expired-token", { display_name: "Acme Weddings" });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ success: false, error: { code: "UNAUTHORIZED" } });
  });

  it("returns 422 VALIDATION_ERROR for a missing display_name", async () => {
    const response = await handler("Bearer a-valid-access-token", {});

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("returns 422 VALIDATION_ERROR for an empty-string display_name", async () => {
    const response = await handler("Bearer a-valid-access-token", { display_name: "" });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("returns 422 VALIDATION_ERROR for a whitespace-only display_name even with a valid slug, and creates nothing", async () => {
    const response = await handler("Bearer a-valid-access-token", {
      display_name: "   ",
      slug: "acme-weddings",
    });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
    expect(organizationRepository.created).toHaveLength(0);
  });

  it("returns 422 VALIDATION_ERROR when the supplied slug normalizes to empty", async () => {
    const response = await handler("Bearer a-valid-access-token", {
      display_name: "Acme",
      slug: "!!!",
    });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("returns 409 ORGANIZATION_SLUG_ALREADY_EXISTS on a slug collision", async () => {
    organizationRepository.failure = { code: "23505", message: "duplicate key" };

    const response = await handler("Bearer a-valid-access-token", {
      display_name: "Acme",
      slug: "acme",
    });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "ORGANIZATION_SLUG_ALREADY_EXISTS" },
    });
  });

  it("returns 500 without leaking details on an unexpected failure", async () => {
    organizationRepository.failure = new Error("connection reset");

    const response = await handler("Bearer a-valid-access-token", {
      display_name: "Acme",
      slug: "acme",
    });

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR" },
    });
    expect(JSON.stringify(response.body)).not.toContain("connection reset");
  });

  it("ignores any client-supplied organization id — the server always generates its own", async () => {
    const response = await handler("Bearer a-valid-access-token", {
      display_name: "Acme",
      id: "attacker-supplied-id",
    });

    expect(response.status).toBe(201);
    const body = response.body as { data: { id: string; membership: { organization_id: string } } };
    expect(body.data.id).not.toBe("attacker-supplied-id");
    expect(body.data.membership.organization_id).toBe(body.data.id);
  });
});
