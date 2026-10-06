import { describe, expect, it } from "vitest";
import { Email } from "../value-objects/email";
import { Invitation } from "./invitation";

const BASE_PARAMS = {
  id: "invitation-id",
  organizationId: "organization-id",
  email: Email.create("invitee@example.com"),
  role: "MEMBER" as const,
  tokenHash: "a-token-hash",
  invitedBy: "inviter-id",
};

describe("Invitation", () => {
  it("starts PENDING and expires exactly 7 days after creation", () => {
    const createdAt = new Date("2026-01-01T00:00:00Z");
    const invitation = Invitation.create({ ...BASE_PARAMS, createdAt });

    expect(invitation.status).toBe("PENDING");
    expect(invitation.acceptedAt).toBeNull();
    expect(invitation.expiresAt.toISOString()).toBe("2026-01-08T00:00:00.000Z");
  });

  it("is active-pending before expiry", () => {
    const createdAt = new Date("2026-01-01T00:00:00Z");
    const invitation = Invitation.create({ ...BASE_PARAMS, createdAt });

    const justBeforeExpiry = new Date("2026-01-07T23:59:59Z");
    expect(invitation.isExpired(justBeforeExpiry)).toBe(false);
    expect(invitation.isActivePending(justBeforeExpiry)).toBe(true);
  });

  it("is expired and no longer active-pending after the 7-day TTL", () => {
    const createdAt = new Date("2026-01-01T00:00:00Z");
    const invitation = Invitation.create({ ...BASE_PARAMS, createdAt });

    const afterExpiry = new Date("2026-01-08T00:00:01Z");
    expect(invitation.isExpired(afterExpiry)).toBe(true);
    expect(invitation.isActivePending(afterExpiry)).toBe(false);
  });

  it("is never active-pending once ACCEPTED, regardless of expiry", () => {
    const invitation = Invitation.fromPersistence({
      ...BASE_PARAMS,
      status: "ACCEPTED",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      expiresAt: new Date("2099-01-01T00:00:00Z"),
      acceptedAt: new Date("2026-01-02T00:00:00Z"),
    });

    expect(invitation.isActivePending()).toBe(false);
  });
});
