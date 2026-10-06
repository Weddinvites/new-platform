import { err, ok, type Result } from "@allinvites/kernel";
import type {
  ListActiveOrganizationIdsService,
  VerifyActiveMembershipService,
} from "@allinvites/module-identity";
import { describe, expect, it } from "vitest";
import { Organization } from "../../domain/entities/organization";
import type { OrganizationRepository } from "../../domain/repositories/organization-repository";
import { Slug } from "../../domain/value-objects/slug";
import type {
  SessionVerifier,
  SessionVerifierError,
  VerifiedCaller,
} from "../ports/session-verifier";
import { ListOrganizationsUseCase } from "./list-organizations.use-case";
import { RetrieveOrganizationUseCase } from "./retrieve-organization.use-case";

const CALLER_ID = "11111111-1111-1111-1111-111111111111";
const ORGANIZATION_ID = "22222222-2222-2222-2222-222222222222";

const session: SessionVerifier = {
  async verify(): Promise<Result<VerifiedCaller, SessionVerifierError>> {
    return ok({ userId: CALLER_ID });
  },
};

function organization(status: "ACTIVE" | "SUSPENDED" = "ACTIVE"): Organization {
  return Organization.fromPersistence({
    id: ORGANIZATION_ID,
    organizationType: "PARTNER",
    slug: Slug.fromPersistence("acme"),
    displayName: "Acme",
    createdAt: new Date(),
    organizationStatus: status,
  });
}

function organizationRepository(
  found: Organization | null,
  calls: { findByIds: number },
): OrganizationRepository {
  return {
    async findById() {
      return found;
    },
    async findByIds() {
      calls.findByIds += 1;
      return { items: [], total: 0 };
    },
  } as unknown as OrganizationRepository;
}

const notAMember: VerifyActiveMembershipService = async () => err({ type: "NOT_A_MEMBER" });

describe("RetrieveOrganizationUseCase — platform visibility (STORY-003-004)", () => {
  it("lets a platform-privileged non-member retrieve an ACTIVE organization", async () => {
    const useCase = new RetrieveOrganizationUseCase(
      organizationRepository(organization(), { findByIds: 0 }),
      notAMember,
      session,
      async () => true,
    );

    const result = await useCase.execute("token", ORGANIZATION_ID);

    expect(result.ok).toBe(true);
  });

  it("keeps NOT_FOUND for a non-member who is not platform-privileged", async () => {
    const useCase = new RetrieveOrganizationUseCase(
      organizationRepository(organization(), { findByIds: 0 }),
      notAMember,
      session,
      async () => false,
    );

    const result = await useCase.execute("token", ORGANIZATION_ID);

    expect(result).toEqual(err({ type: "NOT_FOUND" }));
  });

  it("denies a platform-privileged caller the SUSPENDED organization with ORGANIZATION_SUSPENDED", async () => {
    const useCase = new RetrieveOrganizationUseCase(
      organizationRepository(organization("SUSPENDED"), { findByIds: 0 }),
      notAMember,
      session,
      async () => true,
    );

    const result = await useCase.execute("token", ORGANIZATION_ID);

    expect(result).toEqual(err({ type: "ORGANIZATION_SUSPENDED" }));
  });

  it("returns UNEXPECTED when the platform check throws, never NOT_FOUND", async () => {
    const useCase = new RetrieveOrganizationUseCase(
      organizationRepository(organization(), { findByIds: 0 }),
      notAMember,
      session,
      async () => {
        throw new Error("db down");
      },
    );

    const result = await useCase.execute("token", ORGANIZATION_ID);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });
});

describe("ListOrganizationsUseCase — platform visibility (STORY-003-004)", () => {
  const command = { page: 1, pageSize: 25 };

  it("lists every organization, via findPage, for a platform-privileged caller", async () => {
    const calls = { findByIds: 0 };
    let pageCalls = 0;
    const listIds: ListActiveOrganizationIdsService = async () => ok({ organizationIds: [] });
    const useCase = new ListOrganizationsUseCase(
      organizationRepository(null, calls),
      listIds,
      session,
      {
        isPlatformPrivileged: async () => true,
        organizations: {
          async findPage() {
            pageCalls += 1;
            return { items: [organization("SUSPENDED")], total: 1 };
          },
        },
      },
    );

    const result = await useCase.execute("token", command);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total).toBe(1);
    expect(result.value.items[0]?.organizationStatus).toBe("SUSPENDED");
    expect(pageCalls).toBe(1);
    expect(calls.findByIds).toBe(0);
  });

  it("uses the ACTIVE-membership path for a caller who is not platform-privileged", async () => {
    const calls = { findByIds: 0 };
    let pageCalls = 0;
    const listIds: ListActiveOrganizationIdsService = async () =>
      ok({ organizationIds: [ORGANIZATION_ID] });
    const useCase = new ListOrganizationsUseCase(
      organizationRepository(null, calls),
      listIds,
      session,
      {
        isPlatformPrivileged: async () => false,
        organizations: {
          async findPage() {
            pageCalls += 1;
            return { items: [], total: 0 };
          },
        },
      },
    );

    const result = await useCase.execute("token", command);

    expect(result.ok).toBe(true);
    expect(calls.findByIds).toBe(1);
    expect(pageCalls).toBe(0);
  });
});
