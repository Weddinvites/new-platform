import { err, ok, type Result } from "@allinvites/kernel";
import type {
  ListActiveOrganizationIdsError,
  ListActiveOrganizationIdsResult,
  ListActiveOrganizationIdsService,
} from "@allinvites/module-identity";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  SessionVerifier,
  SessionVerifierError,
  VerifiedCaller,
} from "../../application/ports/session-verifier";
import { ListOrganizationsUseCase } from "../../application/use-cases/list-organizations.use-case";
import { Organization } from "../../domain/entities/organization";
import type { OrganizationRepository } from "../../domain/repositories/organization-repository";
import { Slug } from "../../domain/value-objects/slug";
import { createListOrganizationsHandler } from "./list-organizations.handler";

const CALLER_ID = "11111111-1111-1111-1111-111111111111";

class FakeOrganizationRepository implements OrganizationRepository {
  findByIdsResult: { items: Organization[]; total: number } = { items: [], total: 0 };
  findByIdsCalls: { ids: string[]; pagination: { page: number; pageSize: number } }[] = [];

  async create(): Promise<void> {
    throw new Error("not used");
  }

  async findById(): Promise<Organization | null> {
    throw new Error("not used");
  }

  async findByIds(
    ids: string[],
    pagination: { page: number; pageSize: number },
  ): Promise<{ items: Organization[]; total: number }> {
    this.findByIdsCalls.push({ ids, pagination });
    return this.findByIdsResult;
  }
}

class FakeSessionVerifier implements SessionVerifier {
  result: Result<VerifiedCaller, SessionVerifierError> = ok({ userId: CALLER_ID });

  async verify(): Promise<Result<VerifiedCaller, SessionVerifierError>> {
    return this.result;
  }
}

function fakeListActiveOrganizationIds(
  result: Result<ListActiveOrganizationIdsResult, ListActiveOrganizationIdsError>,
): ListActiveOrganizationIdsService {
  return async () => result;
}

function organization(id: string): Organization {
  return Organization.fromPersistence({
    id,
    organizationType: "PARTNER",
    slug: Slug.fromPersistence(id),
    displayName: id,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  });
}

describe("listOrganizationsHandler", () => {
  let organizationRepository: FakeOrganizationRepository;
  let sessionVerifier: FakeSessionVerifier;

  beforeEach(() => {
    organizationRepository = new FakeOrganizationRepository();
    sessionVerifier = new FakeSessionVerifier();
  });

  function buildHandler(listActiveOrganizationIds: ListActiveOrganizationIdsService) {
    const useCase = new ListOrganizationsUseCase(
      organizationRepository,
      listActiveOrganizationIds,
      sessionVerifier,
    );
    return createListOrganizationsHandler(useCase);
  }

  it("returns 200 with the exact List Users-style pagination envelope", async () => {
    organizationRepository.findByIdsResult = { items: [organization("org-1")], total: 3 };
    const handler = buildHandler(fakeListActiveOrganizationIds(ok({ organizationIds: ["org-1"] })));

    const response = await handler("Bearer a-valid-access-token", { page: "1", pageSize: "25" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: [
        {
          id: "org-1",
          organization_type: "PARTNER",
          slug: "org-1",
          display_name: "org-1",
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      pagination: { page: 1, pageSize: 25, totalItems: 3, totalPages: 1 },
    });
  });

  it("does not include hasPrevious or hasNext in the pagination object", async () => {
    organizationRepository.findByIdsResult = { items: [], total: 0 };
    const handler = buildHandler(fakeListActiveOrganizationIds(ok({ organizationIds: [] })));

    const response = await handler("Bearer a-valid-access-token", {});

    const body = response.body as { pagination: Record<string, unknown> };
    expect(Object.keys(body.pagination).sort()).toEqual([
      "page",
      "pageSize",
      "totalItems",
      "totalPages",
    ]);
  });

  it("returns 401 UNAUTHORIZED when no Authorization header is present", async () => {
    const handler = buildHandler(fakeListActiveOrganizationIds(ok({ organizationIds: [] })));

    const response = await handler(null, {});

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ success: false, error: { code: "UNAUTHORIZED" } });
  });

  it("returns 422 VALIDATION_ERROR for an out-of-range pageSize", async () => {
    const handler = buildHandler(fakeListActiveOrganizationIds(ok({ organizationIds: [] })));

    const response = await handler("Bearer a-valid-access-token", { pageSize: "101" });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("defaults to page=1, pageSize=25 when omitted", async () => {
    const handler = buildHandler(fakeListActiveOrganizationIds(ok({ organizationIds: [] })));

    const response = await handler("Bearer a-valid-access-token", {});

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ pagination: { page: 1, pageSize: 25 } });
  });

  it("returns an empty data array with correct pagination for a page beyond the last one", async () => {
    organizationRepository.findByIdsResult = { items: [], total: 2 };
    const handler = buildHandler(
      fakeListActiveOrganizationIds(ok({ organizationIds: ["org-1", "org-2"] })),
    );

    const response = await handler("Bearer a-valid-access-token", { page: "99", pageSize: "25" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: [],
      pagination: { page: 99, pageSize: 25, totalItems: 2, totalPages: 1 },
    });
  });

  it("returns 500 without leaking details on an unexpected failure", async () => {
    const handler = buildHandler(
      fakeListActiveOrganizationIds(err({ type: "UNEXPECTED", cause: new Error("db down") })),
    );

    const response = await handler("Bearer a-valid-access-token", {});

    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain("db down");
  });
});
