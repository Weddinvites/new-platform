import { describe, expect, it } from "vitest";
import { Subscription } from "../../domain/entities/subscription";
import type { SubscriptionRepository } from "../../domain/repositories/subscription-repository";
import { createRetrieveSubscriptionSummaryService } from "./retrieve-subscription-summary.service";

const ORGANIZATION_ID = "22222222-2222-2222-2222-222222222222";

class FakeSubscriptionRepository implements Pick<SubscriptionRepository, "findByOrganizationId"> {
  subscription: Subscription | null = null;
  failure: unknown;

  async findByOrganizationId(): Promise<Subscription | null> {
    if (this.failure) {
      throw this.failure;
    }
    return this.subscription;
  }
}

describe("createRetrieveSubscriptionSummaryService", () => {
  it("returns the stored status when within the trial window", async () => {
    const repository = new FakeSubscriptionRepository();
    repository.subscription = Subscription.fromPersistence({
      id: "sub-1",
      organizationId: ORGANIZATION_ID,
      plan: "PLANNER_ESENCIAL",
      status: "TRIAL",
      trialEndsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const service = createRetrieveSubscriptionSummaryService(repository);

    const result = await service({ organizationId: ORGANIZATION_ID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.plan).toBe("PLANNER_ESENCIAL");
    expect(result.value.status).toBe("TRIAL");
  });

  it("returns the effective PAST_DUE status once the trial window has passed, not the raw stored TRIAL value", async () => {
    const repository = new FakeSubscriptionRepository();
    repository.subscription = Subscription.fromPersistence({
      id: "sub-1",
      organizationId: ORGANIZATION_ID,
      plan: "EMPRENDEDOR",
      status: "TRIAL",
      trialEndsAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 31),
    });
    const service = createRetrieveSubscriptionSummaryService(repository);

    const result = await service({ organizationId: ORGANIZATION_ID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("PAST_DUE");
  });

  it("returns NOT_FOUND when no Subscription row exists for the Organization (defensive — should not occur)", async () => {
    const repository = new FakeSubscriptionRepository();
    const service = createRetrieveSubscriptionSummaryService(repository);

    const result = await service({ organizationId: ORGANIZATION_ID });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "NOT_FOUND" });
  });

  it("returns UNEXPECTED when the repository read fails", async () => {
    const repository = new FakeSubscriptionRepository();
    repository.failure = new Error("connection reset");
    const service = createRetrieveSubscriptionSummaryService(repository);

    const result = await service({ organizationId: ORGANIZATION_ID });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });
});
