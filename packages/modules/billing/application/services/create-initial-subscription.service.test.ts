import type { Transaction } from "@allinvites/database";
import { err, ok, type Result } from "@allinvites/kernel";
import type { AuditEvent, RecordAuditEventError } from "@allinvites/module-audit";
import { describe, expect, it } from "vitest";
import type { Subscription } from "../../domain/entities/subscription";
import type { SubscriptionRepository } from "../../domain/repositories/subscription-repository";
import { createCreateInitialSubscriptionService } from "./create-initial-subscription.service";

const FAKE_TX = {} as Transaction;
const ORGANIZATION_ID = "22222222-2222-2222-2222-222222222222";
const CALLER_ID = "11111111-1111-1111-1111-111111111111";

class FakeSubscriptionRepository implements Pick<SubscriptionRepository, "create"> {
  created: Subscription[] = [];
  failure: unknown;

  async create(subscription: Subscription, _tx: Transaction): Promise<void> {
    if (this.failure) {
      throw this.failure;
    }
    this.created.push(subscription);
  }
}

function fakeRecordAuditEvent(result: Result<void, RecordAuditEventError> = ok(undefined)): {
  service: (event: AuditEvent, tx: Transaction) => Promise<Result<void, RecordAuditEventError>>;
  calls: { event: AuditEvent; tx: Transaction }[];
} {
  const calls: { event: AuditEvent; tx: Transaction }[] = [];
  const service = async (event: AuditEvent, tx: Transaction) => {
    calls.push({ event, tx });
    return result;
  };
  return { service, calls };
}

describe("createCreateInitialSubscriptionService", () => {
  it("creates a TRIAL subscription and records one audit event, inside the caller's transaction", async () => {
    const repository = new FakeSubscriptionRepository();
    const { service: recordAuditEvent, calls } = fakeRecordAuditEvent();
    const service = createCreateInitialSubscriptionService(repository, recordAuditEvent);

    const result = await service(
      { organizationId: ORGANIZATION_ID, plan: "PLANNER_ESENCIAL", userId: CALLER_ID },
      FAKE_TX,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.plan).toBe("PLANNER_ESENCIAL");
    expect(result.value.status).toBe("TRIAL");
    expect(repository.created).toHaveLength(1);
    expect(repository.created[0].organizationId).toBe(ORGANIZATION_ID);
    expect(calls).toHaveLength(1);
    expect(calls[0].event).toMatchObject({
      userId: CALLER_ID,
      organizationId: ORGANIZATION_ID,
      action: "SUBSCRIPTION_CREATED",
      resourceType: "Subscription",
      result: "SUCCESS",
    });
    expect(calls[0].tx).toBe(FAKE_TX);
  });

  it("returns UNEXPECTED when the repository insert fails, without recording an audit event", async () => {
    const repository = new FakeSubscriptionRepository();
    repository.failure = new Error("unique constraint violation");
    const { service: recordAuditEvent, calls } = fakeRecordAuditEvent();
    const service = createCreateInitialSubscriptionService(repository, recordAuditEvent);

    const result = await service(
      { organizationId: ORGANIZATION_ID, plan: "PLANNER_ESENCIAL", userId: CALLER_ID },
      FAKE_TX,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
    expect(calls).toHaveLength(0);
  });

  it("throws (to roll back the caller's transaction) when the audit record cannot be written", async () => {
    const repository = new FakeSubscriptionRepository();
    const { service: recordAuditEvent } = fakeRecordAuditEvent(
      err({ type: "UNEXPECTED", cause: new Error("audit_logs trigger rejected the insert") }),
    );
    const service = createCreateInitialSubscriptionService(repository, recordAuditEvent);

    await expect(
      service(
        { organizationId: ORGANIZATION_ID, plan: "PLANNER_ESENCIAL", userId: CALLER_ID },
        FAKE_TX,
      ),
    ).rejects.toThrow("Audit record could not be written.");
  });
});
