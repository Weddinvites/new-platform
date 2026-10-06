import { describe, expect, it } from "vitest";
import {
  organizationSettingsParamsSchema,
  updateOrganizationSettingsRequestSchema,
} from "./organization-settings.validator";

describe("organizationSettingsParamsSchema", () => {
  it("accepts a valid UUID", () => {
    const result = organizationSettingsParamsSchema.safeParse({
      organizationId: "22222222-2222-4222-8222-222222222222",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a malformed organizationId", () => {
    const result = organizationSettingsParamsSchema.safeParse({ organizationId: "not-a-uuid" });

    expect(result.success).toBe(false);
  });
});

describe("updateOrganizationSettingsRequestSchema", () => {
  it("accepts a valid email", () => {
    const result = updateOrganizationSettingsRequestSchema.safeParse({
      support_contact_email: "support@acme.test",
    });

    expect(result.success).toBe(true);
  });

  it("trims a value with leading/trailing whitespace", () => {
    const result = updateOrganizationSettingsRequestSchema.safeParse({
      support_contact_email: "  support@acme.test  ",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.support_contact_email).toBe("support@acme.test");
  });

  it("rejects a missing support_contact_email", () => {
    const result = updateOrganizationSettingsRequestSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("rejects an empty-string support_contact_email", () => {
    const result = updateOrganizationSettingsRequestSchema.safeParse({
      support_contact_email: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only support_contact_email", () => {
    const result = updateOrganizationSettingsRequestSchema.safeParse({
      support_contact_email: "   ",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a malformed email address", () => {
    const result = updateOrganizationSettingsRequestSchema.safeParse({
      support_contact_email: "not-an-email",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a non-object payload", () => {
    const result = updateOrganizationSettingsRequestSchema.safeParse(undefined);

    expect(result.success).toBe(false);
  });

  it("rejects an email longer than 254 characters", () => {
    const result = updateOrganizationSettingsRequestSchema.safeParse({
      support_contact_email: `${"a".repeat(250)}@acme.test`,
    });

    expect(result.success).toBe(false);
  });

  it("accepts an internationalized (punycode) domain", () => {
    const result = updateOrganizationSettingsRequestSchema.safeParse({
      support_contact_email: "support@xn--e1aybc.xn--p1ai",
    });

    expect(result.success).toBe(true);
  });

  it("accepts a single-label domain such as localhost", () => {
    const result = updateOrganizationSettingsRequestSchema.safeParse({
      support_contact_email: "support@localhost",
    });

    expect(result.success).toBe(true);
  });
});
