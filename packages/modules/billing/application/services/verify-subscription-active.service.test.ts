import { describe, expect, it } from "vitest";
import { Subscription } from "../../domain/entities/subscription";
import type { SubscriptionRepository } from "../../domain/repositories/subscription-repository";
import { createVerifySubscriptionActiveService } from "./verify-subscription-active.service";

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

describe("createVerifySubscriptionActiveService", () => {
  it("succeeds for a TRIAL subscription within its window", async () => {
    const repository = new FakeSubscriptionRepository();
    repository.subscription = Subscription.fromPersistence({
      id: "sub-1",
      organizationId: ORGANIZATION_ID,
      plan: "EMPRENDEDOR",
      status: "TRIAL",
      trialEndsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      createdAt: new Date(),
    });
    const service = createVerifySubscriptionActiveService(repository);

    const result = await service({ organizationId: ORGANIZATION_ID });

    expect(result.ok).toBe(true);
  });

  it("succeeds for an ACTIVE subscription", async () => {
    const repository = new FakeSubscriptionRepository();
    repository.subscription = Subscription.fromPersistence({
      id: "sub-1",
      organizationId: ORGANIZATION_ID,
      plan: "EMPRENDEDOR",
      status: "ACTIVE",
      trialEndsAt: null,
      createdAt: new Date(),
    });
    const service = createVerifySubscriptionActiveService(repository);

    const result = await service({ organizationId: ORGANIZATION_ID });

    expect(result.ok).toBe(true);
  });

  it("returns SUBSCRIPTION_PAST_DUE for a TRIAL subscription past its trialEndsAt", async () => {
    const repository = new FakeSubscriptionRepository();
    repository.subscription = Subscription.fromPersistence({
      id: "sub-1",
      organizationId: ORGANIZATION_ID,
      plan: "EMPRENDEDOR",
      status: "TRIAL",
      trialEndsAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 31),
    });
    const service = createVerifySubscriptionActiveService(repository);

    const result = await service({ organizationId: ORGANIZATION_ID });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "SUBSCRIPTION_PAST_DUE" });
  });

  it("returns SUBSCRIPTION_PAST_DUE for a stored PAST_DUE subscription", async () => {
    const repository = new FakeSubscriptionRepository();
    repository.subscription = Subscription.fromPersistence({
      id: "sub-1",
      organizationId: ORGANIZATION_ID,
      plan: "EMPRENDEDOR",
      status: "PAST_DUE",
      trialEndsAt: null,
      createdAt: new Date(),
    });
    const service = createVerifySubscriptionActiveService(repository);

    const result = await service({ organizationId: ORGANIZATION_ID });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "SUBSCRIPTION_PAST_DUE" });
  });

  it("returns UNEXPECTED when no Subscription row exists for the Organization (defensive — should not occur)", async () => {
    const repository = new FakeSubscriptionRepository();
    const service = createVerifySubscriptionActiveService(repository);

    const result = await service({ organizationId: ORGANIZATION_ID });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });

  it("returns UNEXPECTED when the repository read fails", async () => {
    const repository = new FakeSubscriptionRepository();
    repository.failure = new Error("connection reset");
    const service = createVerifySubscriptionActiveService(repository);

    const result = await service({ organizationId: ORGANIZATION_ID });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });
});
