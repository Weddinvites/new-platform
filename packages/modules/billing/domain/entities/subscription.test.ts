import { describe, expect, it } from "vitest";
import { Subscription } from "./subscription";

describe("Subscription", () => {
  it("creates a TRIAL subscription with trialEndsAt 30 days out", () => {
    const before = new Date();
    const subscription = Subscription.create({
      id: "sub-1",
      organizationId: "org-1",
      plan: "EMPRENDEDOR",
    });
    const after = new Date();

    expect(subscription.status).toBe("TRIAL");
    expect(subscription.plan).toBe("EMPRENDEDOR");
    expect(subscription.trialEndsAt).not.toBeNull();
    const trialEndsAt = subscription.trialEndsAt as Date;
    const diffMs = trialEndsAt.getTime() - subscription.createdAt.getTime();
    expect(diffMs).toBe(30 * 24 * 60 * 60 * 1000);
    expect(subscription.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(subscription.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("reports effectiveStatus TRIAL while within the trial window", () => {
    const subscription = Subscription.fromPersistence({
      id: "sub-1",
      organizationId: "org-1",
      plan: "EMPRENDEDOR",
      status: "TRIAL",
      trialEndsAt: new Date("2026-02-01T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(subscription.effectiveStatus(new Date("2026-01-15T00:00:00.000Z"))).toBe("TRIAL");
    expect(subscription.isPastDue(new Date("2026-01-15T00:00:00.000Z"))).toBe(false);
  });

  it("reports effectiveStatus PAST_DUE once the trial window has passed, without mutating the stored status", () => {
    const subscription = Subscription.fromPersistence({
      id: "sub-1",
      organizationId: "org-1",
      plan: "EMPRENDEDOR",
      status: "TRIAL",
      trialEndsAt: new Date("2026-02-01T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(subscription.effectiveStatus(new Date("2026-02-02T00:00:00.000Z"))).toBe("PAST_DUE");
    expect(subscription.isPastDue(new Date("2026-02-02T00:00:00.000Z"))).toBe(true);
    // The raw stored field is never mutated by a derived read.
    expect(subscription.status).toBe("TRIAL");
  });

  it("is not past due exactly at the trialEndsAt boundary (only strictly after)", () => {
    const trialEndsAt = new Date("2026-02-01T00:00:00.000Z");
    const subscription = Subscription.fromPersistence({
      id: "sub-1",
      organizationId: "org-1",
      plan: "EMPRENDEDOR",
      status: "TRIAL",
      trialEndsAt,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(subscription.isPastDue(trialEndsAt)).toBe(false);
  });

  it("leaves a non-TRIAL status unaffected by the trial window", () => {
    const subscription = Subscription.fromPersistence({
      id: "sub-1",
      organizationId: "org-1",
      plan: "EMPRENDEDOR",
      status: "ACTIVE",
      trialEndsAt: new Date("2026-01-01T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(subscription.effectiveStatus(new Date("2026-06-01T00:00:00.000Z"))).toBe("ACTIVE");
    expect(subscription.isPastDue(new Date("2026-06-01T00:00:00.000Z"))).toBe(false);
  });

  it("treats a stored PAST_DUE status as past due regardless of trialEndsAt", () => {
    const subscription = Subscription.fromPersistence({
      id: "sub-1",
      organizationId: "org-1",
      plan: "EMPRENDEDOR",
      status: "PAST_DUE",
      trialEndsAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(subscription.isPastDue()).toBe(true);
  });

  it("is never past due when trialEndsAt is null, even while TRIAL (defensive — should not occur via create())", () => {
    const subscription = Subscription.fromPersistence({
      id: "sub-1",
      organizationId: "org-1",
      plan: "EMPRENDEDOR",
      status: "TRIAL",
      trialEndsAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(subscription.isPastDue(new Date("2099-01-01T00:00:00.000Z"))).toBe(false);
  });
});
