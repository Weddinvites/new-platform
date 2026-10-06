import type { Transaction } from "@allinvites/database";
import { err, ok, type Result } from "@allinvites/kernel";
import type {
  VerifyActiveMembershipError,
  VerifyActiveMembershipService,
} from "@allinvites/module-identity";
import { beforeEach, describe, expect, it } from "vitest";
import { Organization, type OrganizationStatus } from "../../domain/entities/organization";
import type { OrganizationStatusRepository } from "../../domain/repositories/organization-status-repository";
import type { OrganizationType } from "../../domain/value-objects/organization-type";
import { Slug } from "../../domain/value-objects/slug";
import type { AuditRecord } from "../ports/audit-recorder";
import type {
  SessionVerifier,
  SessionVerifierError,
  VerifiedCaller,
} from "../ports/session-verifier";
import { SetOrganizationStatusUseCase } from "./set-organization-status.use-case";

const CALLER_ID = "11111111-1111-1111-1111-111111111111";
const ORGANIZATION_ID = "22222222-2222-2222-2222-222222222222";

class FakeOrganizationStatusRepository implements OrganizationStatusRepository {
  organizationsById = new Map<string, Organization>();
  /** Values returned by the next findById calls, ahead of the live state — simulates a stale read. */
  staleReads: Organization[] = [];
  updates: { id: string; from: OrganizationStatus; to: OrganizationStatus }[] = [];

  async findById(id: string): Promise<Organization | null> {
    return this.staleReads.shift() ?? this.organizationsById.get(id) ?? null;
  }

  async findSystemOrganization(): Promise<Organization | null> {
    throw new Error("not used by SetOrganizationStatusUseCase tests");
  }

  async findPage(): Promise<{ items: Organization[]; total: number }> {
    throw new Error("not used by SetOrganizationStatusUseCase tests");
  }

  async updateStatus(
    id: string,
    from: OrganizationStatus,
    to: OrganizationStatus,
  ): Promise<Organization | null> {
    const current = this.organizationsById.get(id);
    if (!current || current.organizationStatus !== from) {
      return null;
    }
    this.updates.push({ id, from, to });
    const next = Organization.fromPersistence({
      id: current.id,
      organizationType: current.organizationType,
      slug: current.slug,
      displayName: current.displayName,
      createdAt: current.createdAt,
      organizationStatus: to,
    });
    this.organizationsById.set(id, next);
    return next;
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

function organization(
  status: OrganizationStatus = "ACTIVE",
  organizationType: OrganizationType = "PARTNER",
): Organization {
  return Organization.fromPersistence({
    id: ORGANIZATION_ID,
    organizationType,
    slug: Slug.fromPersistence("acme"),
    displayName: "Acme",
    createdAt: new Date(),
    organizationStatus: status,
  });
}

function build(options: {
  privileged: boolean | Error;
  membership?: Result<void, VerifyActiveMembershipError>;
  audit?: Result<void, { readonly type: "UNEXPECTED"; readonly cause: unknown }>;
}) {
  const repository = new FakeOrganizationStatusRepository();
  const audits: AuditRecord[] = [];
  const sessionVerifier = new FakeSessionVerifier();
  const verifyActiveMembership: VerifyActiveMembershipService = async () =>
    options.membership ?? err({ type: "NOT_A_MEMBER" });
  const useCase = new SetOrganizationStatusUseCase(
    repository,
    async () => {
      if (options.privileged instanceof Error) throw options.privileged;
      return options.privileged;
    },
    verifyActiveMembership,
    async (record) => {
      audits.push(record);
      return options.audit ?? ok(undefined);
    },
    sessionVerifier,
    new FakeDatabase() as never,
  );
  return { repository, audits, sessionVerifier, useCase };
}

describe("SetOrganizationStatusUseCase (STORY-003-004)", () => {
  let fixture: ReturnType<typeof build>;

  beforeEach(() => {
    fixture = build({ privileged: true });
    fixture.repository.organizationsById.set(ORGANIZATION_ID, organization("ACTIVE"));
  });

  it("suspends an ACTIVE organization for a platform-privileged caller and audit-logs it", async () => {
    const result = await fixture.useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      status: "SUSPENDED",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.changed).toBe(true);
    expect(result.value.organization.organizationStatus).toBe("SUSPENDED");
    expect(fixture.repository.updates).toEqual([
      { id: ORGANIZATION_ID, from: "ACTIVE", to: "SUSPENDED" },
    ]);
    expect(fixture.audits).toEqual([
      {
        userId: CALLER_ID,
        organizationId: ORGANIZATION_ID,
        action: "ORGANIZATION_SUSPENDED",
        resourceType: "ORGANIZATION",
        resourceId: ORGANIZATION_ID,
        result: "SUCCESS",
        metadata: { previousStatus: "ACTIVE", newStatus: "SUSPENDED" },
      },
    ]);
  });

  it("activates a SUSPENDED organization and audit-logs ORGANIZATION_ACTIVATED", async () => {
    fixture.repository.organizationsById.set(ORGANIZATION_ID, organization("SUSPENDED"));

    const result = await fixture.useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      status: "ACTIVE",
    });

    expect(result.ok).toBe(true);
    expect(fixture.audits).toHaveLength(1);
    expect(fixture.audits[0]?.action).toBe("ORGANIZATION_ACTIVATED");
  });

  it("is idempotent: suspending an already SUSPENDED organization writes and audits nothing", async () => {
    fixture.repository.organizationsById.set(ORGANIZATION_ID, organization("SUSPENDED"));

    const result = await fixture.useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      status: "SUSPENDED",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.changed).toBe(false);
    expect(fixture.repository.updates).toHaveLength(0);
    expect(fixture.audits).toHaveLength(0);
  });

  it("is idempotent: activating an already ACTIVE organization writes and audits nothing", async () => {
    const result = await fixture.useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      status: "ACTIVE",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.changed).toBe(false);
    expect(fixture.audits).toHaveLength(0);
  });

  it("returns NOT_FOUND for a SYSTEM organization and changes nothing", async () => {
    fixture.repository.organizationsById.set(ORGANIZATION_ID, organization("ACTIVE", "SYSTEM"));

    const result = await fixture.useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      status: "SUSPENDED",
    });

    expect(result).toEqual(err({ type: "NOT_FOUND" }));
    expect(fixture.repository.updates).toHaveLength(0);
  });

  it("returns NOT_FOUND for a nonexistent organization", async () => {
    const result = await fixture.useCase.execute("token", {
      organizationId: "99999999-9999-9999-9999-999999999999",
      status: "SUSPENDED",
    });

    expect(result).toEqual(err({ type: "NOT_FOUND" }));
  });

  it("returns NOT_FOUND for a non-privileged caller with no membership in the target", async () => {
    const denied = build({ privileged: false, membership: err({ type: "NOT_A_MEMBER" }) });
    denied.repository.organizationsById.set(ORGANIZATION_ID, organization("ACTIVE"));

    const result = await denied.useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      status: "SUSPENDED",
    });

    expect(result).toEqual(err({ type: "NOT_FOUND" }));
    expect(denied.repository.updates).toHaveLength(0);
  });

  it("returns FORBIDDEN for a non-privileged ACTIVE member of the target", async () => {
    const member = build({ privileged: false, membership: ok(undefined) });
    member.repository.organizationsById.set(ORGANIZATION_ID, organization("ACTIVE"));

    const result = await member.useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      status: "SUSPENDED",
    });

    expect(result).toEqual(err({ type: "FORBIDDEN" }));
    expect(member.repository.updates).toHaveLength(0);
  });

  it("returns UNAUTHORIZED without checking privilege or touching data", async () => {
    fixture.sessionVerifier.result = err({ type: "UNAUTHORIZED" });

    const result = await fixture.useCase.execute("bad", {
      organizationId: ORGANIZATION_ID,
      status: "SUSPENDED",
    });

    expect(result).toEqual(err({ type: "UNAUTHORIZED" }));
    expect(fixture.repository.updates).toHaveLength(0);
  });

  it("returns UNEXPECTED when the platform-privilege check fails", async () => {
    const failing = build({ privileged: new Error("db down") });
    failing.repository.organizationsById.set(ORGANIZATION_ID, organization("ACTIVE"));

    const result = await failing.useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      status: "SUSPENDED",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });

  it("fails the change when the audit record cannot be written (no unaudited change commits)", async () => {
    const auditFailing = build({
      privileged: true,
      audit: err({ type: "UNEXPECTED", cause: new Error("audit down") }),
    });
    auditFailing.repository.organizationsById.set(ORGANIZATION_ID, organization("ACTIVE"));

    const result = await auditFailing.useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      status: "SUSPENDED",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });

  it("re-reads after a lost race and reports no change when a concurrent request already applied the target status", async () => {
    // Stale read says ACTIVE, but a concurrent request has already suspended it.
    fixture.repository.organizationsById.set(ORGANIZATION_ID, organization("SUSPENDED"));
    fixture.repository.staleReads.push(organization("ACTIVE"));

    const result = await fixture.useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      status: "SUSPENDED",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.changed).toBe(false);
    expect(fixture.repository.updates).toHaveLength(0);
    expect(fixture.audits).toHaveLength(0);
  });

  it("writes exactly one audit record when two requests race for the same transition", async () => {
    // Both requests read ACTIVE. Only the first conditional update matches.
    fixture.repository.staleReads.push(organization("ACTIVE"), organization("ACTIVE"));

    const first = await fixture.useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      status: "SUSPENDED",
    });
    const second = await fixture.useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      status: "SUSPENDED",
    });

    expect(first.ok && first.value.changed).toBe(true);
    expect(second.ok && second.value.changed).toBe(false);
    expect(fixture.audits).toHaveLength(1);
  });

  it("returns UNEXPECTED when every attempt loses the race, without writing or auditing", async () => {
    // Row is ACTIVE; every read is stale (SUSPENDED), so each conditional update
    // (WHERE status = SUSPENDED) matches nothing, and the attempts run out.
    fixture.repository.staleReads.push(organization("SUSPENDED"), organization("SUSPENDED"));

    const result = await fixture.useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      status: "ACTIVE",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });
});
