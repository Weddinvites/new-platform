import type { Database, Transaction } from "@allinvites/database";
import { err, ok, type Result } from "@allinvites/kernel";
import type {
  CreateInitialOwnerMembershipError,
  CreateInitialOwnerMembershipParams,
  CreateInitialOwnerMembershipResult,
  CreateInitialOwnerMembershipService,
} from "@allinvites/module-identity";
import { beforeEach, describe, expect, it } from "vitest";
import type { Organization } from "../../domain/entities/organization";
import { InvalidSlugError } from "../../domain/exceptions/invalid-slug.error";
import { OrganizationSlugAlreadyExistsError } from "../../domain/exceptions/organization-slug-already-exists.error";
import type { OrganizationRepository } from "../../domain/repositories/organization-repository";
import type {
  SessionVerifier,
  SessionVerifierError,
  VerifiedCaller,
} from "../ports/session-verifier";
import { CreateOrganizationUseCase } from "./create-organization.use-case";

const CALLER_ID = "11111111-1111-1111-1111-111111111111";
const FAKE_TX = {} as Transaction;

class FakeOrganizationRepository implements OrganizationRepository {
  created: Organization[] = [];
  failure: unknown;

  async create(organization: Organization, _tx: Transaction): Promise<void> {
    if (this.failure) {
      throw this.failure;
    }
    this.created.push(organization);
  }

  async findById(): Promise<Organization | null> {
    throw new Error("not used by CreateOrganizationUseCase tests");
  }
}

class FakeSessionVerifier implements SessionVerifier {
  result: Result<VerifiedCaller, SessionVerifierError> = ok({ userId: CALLER_ID });

  async verify(): Promise<Result<VerifiedCaller, SessionVerifierError>> {
    return this.result;
  }
}

/** A DB stub whose `transaction` just invokes the callback with a fixed tx, matching real drizzle-orm semantics: a thrown error inside the callback rejects `transaction(...)` itself (rollback). */
class FakeDatabase {
  async transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
    return fn(FAKE_TX);
  }
}

function fakeCreateInitialOwnerMembership(
  result: Result<CreateInitialOwnerMembershipResult, CreateInitialOwnerMembershipError>,
): {
  service: CreateInitialOwnerMembershipService;
  calls: { params: CreateInitialOwnerMembershipParams; tx: Transaction }[];
} {
  const calls: { params: CreateInitialOwnerMembershipParams; tx: Transaction }[] = [];
  const service: CreateInitialOwnerMembershipService = async (params, tx) => {
    calls.push({ params, tx });
    return result;
  };
  return { service, calls };
}

describe("CreateOrganizationUseCase", () => {
  let organizationRepository: FakeOrganizationRepository;
  let sessionVerifier: FakeSessionVerifier;

  beforeEach(() => {
    organizationRepository = new FakeOrganizationRepository();
    sessionVerifier = new FakeSessionVerifier();
  });

  function buildUseCase(
    createInitialOwnerMembership: CreateInitialOwnerMembershipService,
  ): CreateOrganizationUseCase {
    return new CreateOrganizationUseCase(
      organizationRepository,
      createInitialOwnerMembership,
      sessionVerifier,
      new FakeDatabase() as unknown as Database,
    );
  }

  it("creates a PARTNER Organization and the caller's OWNER membership atomically", async () => {
    const { service, calls } = fakeCreateInitialOwnerMembership(
      ok({ membershipId: "membership-1" }),
    );
    const useCase = buildUseCase(service);

    const result = await useCase.execute("token", { displayName: "Acme Weddings" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.organization.organizationType).toBe("PARTNER");
    expect(result.value.organization.displayName).toBe("Acme Weddings");
    expect(result.value.membershipId).toBe("membership-1");
    expect(organizationRepository.created).toHaveLength(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].params).toEqual({
      userId: CALLER_ID,
      organizationId: result.value.organization.id,
    });
    expect(calls[0].tx).toBe(FAKE_TX);
  });

  it("derives and normalizes the slug from display_name when slug is omitted", async () => {
    const { service } = fakeCreateInitialOwnerMembership(ok({ membershipId: "membership-1" }));
    const useCase = buildUseCase(service);

    const result = await useCase.execute("token", { displayName: "Acme Weddings & Co." });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.organization.slug.value).toBe("acme-weddings-co");
  });

  it("normalizes a client-supplied slug to lowercase-kebab-case", async () => {
    const { service } = fakeCreateInitialOwnerMembership(ok({ membershipId: "membership-1" }));
    const useCase = buildUseCase(service);

    const result = await useCase.execute("token", {
      displayName: "Acme Weddings",
      slug: "  Custom Slug!! ",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.organization.slug.value).toBe("custom-slug");
  });

  it("rejects a slug that normalizes to an empty string", async () => {
    const { service } = fakeCreateInitialOwnerMembership(ok({ membershipId: "membership-1" }));
    const useCase = buildUseCase(service);

    const result = await useCase.execute("token", { displayName: "Acme", slug: "!!!" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(InvalidSlugError);
    expect(organizationRepository.created).toHaveLength(0);
  });

  it("maps a slug uniqueness violation to ORGANIZATION_SLUG_ALREADY_EXISTS with no partial write", async () => {
    organizationRepository.failure = { code: "23505", message: "duplicate key" };
    const { service, calls } = fakeCreateInitialOwnerMembership(
      ok({ membershipId: "membership-1" }),
    );
    const useCase = buildUseCase(service);

    const result = await useCase.execute("token", { displayName: "Acme", slug: "acme" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(OrganizationSlugAlreadyExistsError);
    expect(calls).toHaveLength(0);
  });

  it("rolls back (returns UNEXPECTED, no orphaned Organization) when the Identity contract reports USER_NOT_FOUND", async () => {
    const { service } = fakeCreateInitialOwnerMembership(err({ type: "USER_NOT_FOUND" }));
    const useCase = buildUseCase(service);

    const result = await useCase.execute("token", { displayName: "Acme" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });

  it("rolls back when the Identity contract fails unexpectedly", async () => {
    const { service } = fakeCreateInitialOwnerMembership(
      err({ type: "UNEXPECTED", cause: new Error("db down") }),
    );
    const useCase = buildUseCase(service);

    const result = await useCase.execute("token", { displayName: "Acme" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });

  it("rejects an unauthenticated caller without creating anything", async () => {
    sessionVerifier.result = err({ type: "UNAUTHORIZED" });
    const { service, calls } = fakeCreateInitialOwnerMembership(
      ok({ membershipId: "membership-1" }),
    );
    const useCase = buildUseCase(service);

    const result = await useCase.execute("bad-token", { displayName: "Acme" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "UNAUTHORIZED" });
    expect(organizationRepository.created).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });

  it("propagates an unexpected session-verification failure distinctly from UNAUTHORIZED", async () => {
    sessionVerifier.result = err({ type: "UNEXPECTED", cause: new Error("network down") });
    const { service } = fakeCreateInitialOwnerMembership(ok({ membershipId: "membership-1" }));
    const useCase = buildUseCase(service);

    const result = await useCase.execute("token", { displayName: "Acme" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });
});
