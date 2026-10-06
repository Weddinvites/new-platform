import { err, ok, type Result } from "@allinvites/kernel";
import type {
  ListActiveOrganizationIdsError,
  ListActiveOrganizationIdsResult,
  ListActiveOrganizationIdsService,
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
import { ListOrganizationsUseCase } from "./list-organizations.use-case";

const CALLER_ID = "11111111-1111-1111-1111-111111111111";

class FakeOrganizationRepository implements OrganizationRepository {
  findByIdsCalls: { ids: string[]; pagination: { page: number; pageSize: number } }[] = [];
  findByIdsResult: { items: Organization[]; total: number } = { items: [], total: 0 };

  async create(): Promise<void> {
    throw new Error("not used by ListOrganizationsUseCase tests");
  }

  async findById(): Promise<Organization | null> {
    throw new Error("not used by ListOrganizationsUseCase tests");
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

function organization(id: string, createdAt: Date = new Date()): Organization {
  return Organization.fromPersistence({
    id,
    organizationType: "PARTNER",
    slug: Slug.fromPersistence(`org-${id}`),
    displayName: `Org ${id}`,
    createdAt,
  });
}

describe("ListOrganizationsUseCase", () => {
  let organizationRepository: FakeOrganizationRepository;
  let sessionVerifier: FakeSessionVerifier;

  beforeEach(() => {
    organizationRepository = new FakeOrganizationRepository();
    sessionVerifier = new FakeSessionVerifier();
  });

  it("returns exactly the organizations for the ACTIVE-scoped ids, paginated at the repository level", async () => {
    organizationRepository.findByIdsResult = {
      items: [organization("org-1"), organization("org-2")],
      total: 2,
    };
    const listActiveOrganizationIds = fakeListActiveOrganizationIds(
      ok({ organizationIds: ["org-1", "org-2"] }),
    );
    const useCase = new ListOrganizationsUseCase(
      organizationRepository,
      listActiveOrganizationIds,
      sessionVerifier,
    );

    const result = await useCase.execute("token", { page: 1, pageSize: 25 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items).toHaveLength(2);
    expect(result.value.total).toBe(2);
    expect(organizationRepository.findByIdsCalls).toEqual([
      { ids: ["org-1", "org-2"], pagination: { page: 1, pageSize: 25 } },
    ]);
  });

  it("includes a SYSTEM organization id returned by Identity under the same rule as PARTNER", async () => {
    organizationRepository.findByIdsResult = {
      items: [organization("system-org")],
      total: 1,
    };
    const listActiveOrganizationIds = fakeListActiveOrganizationIds(
      ok({ organizationIds: ["system-org"] }),
    );
    const useCase = new ListOrganizationsUseCase(
      organizationRepository,
      listActiveOrganizationIds,
      sessionVerifier,
    );

    const result = await useCase.execute("token", { page: 1, pageSize: 25 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items.map((o) => o.id)).toEqual(["system-org"]);
  });

  it("returns an empty result without querying the Organizations repository when the caller has no ACTIVE memberships", async () => {
    const listActiveOrganizationIds = fakeListActiveOrganizationIds(ok({ organizationIds: [] }));
    const useCase = new ListOrganizationsUseCase(
      organizationRepository,
      listActiveOrganizationIds,
      sessionVerifier,
    );

    const result = await useCase.execute("token", { page: 1, pageSize: 25 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ items: [], total: 0 });
    expect(organizationRepository.findByIdsCalls).toHaveLength(0);
  });

  it("passes the requested page/pageSize through to the repository for bounded, database-level pagination", async () => {
    organizationRepository.findByIdsResult = { items: [], total: 120 };
    const listActiveOrganizationIds = fakeListActiveOrganizationIds(
      ok({ organizationIds: Array.from({ length: 120 }, (_, i) => `org-${i}`) }),
    );
    const useCase = new ListOrganizationsUseCase(
      organizationRepository,
      listActiveOrganizationIds,
      sessionVerifier,
    );

    await useCase.execute("token", { page: 3, pageSize: 25 });

    expect(organizationRepository.findByIdsCalls).toEqual([
      {
        ids: Array.from({ length: 120 }, (_, i) => `org-${i}`),
        pagination: { page: 3, pageSize: 25 },
      },
    ]);
  });

  it("returns an empty data array with the true total for a page beyond the last one — not an error", async () => {
    organizationRepository.findByIdsResult = { items: [], total: 2 };
    const listActiveOrganizationIds = fakeListActiveOrganizationIds(
      ok({ organizationIds: ["org-1", "org-2"] }),
    );
    const useCase = new ListOrganizationsUseCase(
      organizationRepository,
      listActiveOrganizationIds,
      sessionVerifier,
    );

    const result = await useCase.execute("token", { page: 99, pageSize: 25 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ items: [], total: 2 });
  });

  it("rejects an unauthenticated caller without resolving membership scope", async () => {
    sessionVerifier.result = err({ type: "UNAUTHORIZED" });
    const listActiveOrganizationIds = fakeListActiveOrganizationIds(ok({ organizationIds: [] }));
    const useCase = new ListOrganizationsUseCase(
      organizationRepository,
      listActiveOrganizationIds,
      sessionVerifier,
    );

    const result = await useCase.execute("bad-token", { page: 1, pageSize: 25 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "UNAUTHORIZED" });
  });

  it("propagates an unexpected scope-resolution failure", async () => {
    const listActiveOrganizationIds = fakeListActiveOrganizationIds(
      err({ type: "UNEXPECTED", cause: new Error("db down") }),
    );
    const useCase = new ListOrganizationsUseCase(
      organizationRepository,
      listActiveOrganizationIds,
      sessionVerifier,
    );

    const result = await useCase.execute("token", { page: 1, pageSize: 25 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });

  it("tenancy: a caller's list never includes an organization they have no ACTIVE membership in", async () => {
    organizationRepository.findByIdsResult = { items: [organization("org-a")], total: 1 };
    const listActiveOrganizationIds = fakeListActiveOrganizationIds(
      ok({ organizationIds: ["org-a"] }),
    );
    const useCase = new ListOrganizationsUseCase(
      organizationRepository,
      listActiveOrganizationIds,
      sessionVerifier,
    );

    const result = await useCase.execute("token", { page: 1, pageSize: 25 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items.map((o) => o.id)).toEqual(["org-a"]);
    expect(result.value.items.map((o) => o.id)).not.toContain("org-b");
  });
});
