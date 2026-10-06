import { describe, expect, it } from "vitest";
import {
  organizationBrandingParamsSchema,
  updateOrganizationBrandingRequestSchema,
} from "./organization-branding.validator";

describe("organizationBrandingParamsSchema", () => {
  it("accepts a valid UUID", () => {
    const result = organizationBrandingParamsSchema.safeParse({
      organizationId: "22222222-2222-4222-8222-222222222222",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a malformed organizationId", () => {
    const result = organizationBrandingParamsSchema.safeParse({ organizationId: "not-a-uuid" });

    expect(result.success).toBe(false);
  });
});

describe("updateOrganizationBrandingRequestSchema", () => {
  it("accepts a single valid field", () => {
    const result = updateOrganizationBrandingRequestSchema.safeParse({
      brand_name: "Acme Weddings",
    });

    expect(result.success).toBe(true);
  });

  it("accepts multiple valid fields together", () => {
    const result = updateOrganizationBrandingRequestSchema.safeParse({
      brand_name: "Acme Weddings",
      logo: "https://cdn.example.com/logo.png",
      primary_color: "#112233",
      secondary_color: "#445566",
    });

    expect(result.success).toBe(true);
  });

  it("trims brand_name", () => {
    const result = updateOrganizationBrandingRequestSchema.safeParse({
      brand_name: "  Acme  ",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.brand_name).toBe("Acme");
  });

  it("rejects an empty-string brand_name", () => {
    const result = updateOrganizationBrandingRequestSchema.safeParse({ brand_name: "" });

    expect(result.success).toBe(false);
  });

  it("rejects a malformed logo URL", () => {
    const result = updateOrganizationBrandingRequestSchema.safeParse({ logo: "not-a-url" });

    expect(result.success).toBe(false);
  });

  it("rejects a malformed primary_color", () => {
    const result = updateOrganizationBrandingRequestSchema.safeParse({
      primary_color: "blue",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a malformed secondary_color", () => {
    const result = updateOrganizationBrandingRequestSchema.safeParse({
      secondary_color: "#12345",
    });

    expect(result.success).toBe(false);
  });

  it("trims primary_color", () => {
    const result = updateOrganizationBrandingRequestSchema.safeParse({
      primary_color: "  #112233  ",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.primary_color).toBe("#112233");
  });

  it("trims secondary_color", () => {
    const result = updateOrganizationBrandingRequestSchema.safeParse({
      secondary_color: "  #445566  ",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.secondary_color).toBe("#445566");
  });

  it("trims logo (implicitly, via URL parsing)", () => {
    const result = updateOrganizationBrandingRequestSchema.safeParse({
      logo: "  https://cdn.example.com/logo.png  ",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.logo).toBe("https://cdn.example.com/logo.png");
  });

  it("rejects an empty body — at least one field is required", () => {
    const result = updateOrganizationBrandingRequestSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("rejects a non-object payload", () => {
    const result = updateOrganizationBrandingRequestSchema.safeParse(undefined);

    expect(result.success).toBe(false);
  });

  it("does not accept custom_domain or email_branding fields", () => {
    const result = updateOrganizationBrandingRequestSchema.safeParse({
      brand_name: "Acme",
      custom_domain: "www.example.com",
      email_branding: "something",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({ brand_name: "Acme" });
  });
});
