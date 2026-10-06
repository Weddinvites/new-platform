import { describe, expect, it } from "vitest";
import {
  updateOrganizationParamsSchema,
  updateOrganizationRequestSchema,
} from "./update-organization.validator";

describe("updateOrganizationParamsSchema", () => {
  it("accepts a valid UUID", () => {
    const result = updateOrganizationParamsSchema.safeParse({
      organizationId: "22222222-2222-4222-8222-222222222222",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a malformed organizationId", () => {
    const result = updateOrganizationParamsSchema.safeParse({ organizationId: "not-a-uuid" });

    expect(result.success).toBe(false);
  });

  it("rejects a missing organizationId", () => {
    const result = updateOrganizationParamsSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});

describe("updateOrganizationRequestSchema", () => {
  it("accepts a valid display_name", () => {
    const result = updateOrganizationRequestSchema.safeParse({ display_name: "Acme Weddings" });

    expect(result.success).toBe(true);
  });

  it("trims a display_name with leading/trailing whitespace", () => {
    const result = updateOrganizationRequestSchema.safeParse({ display_name: "  Acme  " });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.display_name).toBe("Acme");
  });

  it("rejects a payload missing display_name", () => {
    const result = updateOrganizationRequestSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("rejects an empty-string display_name", () => {
    const result = updateOrganizationRequestSchema.safeParse({ display_name: "" });

    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only display_name", () => {
    const result = updateOrganizationRequestSchema.safeParse({ display_name: "   " });

    expect(result.success).toBe(false);
  });

  it("rejects a non-object payload", () => {
    const result = updateOrganizationRequestSchema.safeParse(undefined);

    expect(result.success).toBe(false);
  });

  it("does not accept slug, organization_type, id, or created_at as editable fields", () => {
    const result = updateOrganizationRequestSchema.safeParse({
      display_name: "Acme",
      slug: "hacked-slug",
      organization_type: "SYSTEM",
      id: "99999999-9999-4999-8999-999999999999",
      created_at: "2000-01-01T00:00:00.000Z",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({ display_name: "Acme" });
  });
});
