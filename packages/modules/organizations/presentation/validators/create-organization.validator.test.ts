import { describe, expect, it } from "vitest";
import { createOrganizationRequestSchema } from "./create-organization.validator";

describe("createOrganizationRequestSchema", () => {
  it("accepts a valid payload without a slug", () => {
    const result = createOrganizationRequestSchema.safeParse({ display_name: "Acme Weddings" });

    expect(result.success).toBe(true);
  });

  it("accepts a valid payload with a slug", () => {
    const result = createOrganizationRequestSchema.safeParse({
      display_name: "Acme Weddings",
      slug: "acme-weddings",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a payload missing display_name", () => {
    const result = createOrganizationRequestSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("rejects an empty-string display_name", () => {
    const result = createOrganizationRequestSchema.safeParse({ display_name: "" });

    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only display_name", () => {
    const result = createOrganizationRequestSchema.safeParse({ display_name: "   " });

    expect(result.success).toBe(false);
  });

  it("trims a padded display_name", () => {
    const result = createOrganizationRequestSchema.safeParse({
      display_name: "  Acme Weddings  ",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.display_name).toBe("Acme Weddings");
  });

  it("rejects a whitespace-only display_name even when a valid slug is supplied", () => {
    const result = createOrganizationRequestSchema.safeParse({
      display_name: "   ",
      slug: "acme-weddings",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an empty-string slug", () => {
    const result = createOrganizationRequestSchema.safeParse({
      display_name: "Acme",
      slug: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a non-object payload", () => {
    const result = createOrganizationRequestSchema.safeParse(undefined);

    expect(result.success).toBe(false);
  });
});
