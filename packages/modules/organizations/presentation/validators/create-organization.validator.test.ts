import { describe, expect, it } from "vitest";
import { createOrganizationRequestSchema } from "./create-organization.validator";

describe("createOrganizationRequestSchema", () => {
  it("accepts a valid payload without a slug", () => {
    const result = createOrganizationRequestSchema.safeParse({
      display_name: "Acme Weddings",
      plan_id: "PLANNER_ESENCIAL",
    });

    expect(result.success).toBe(true);
  });

  it("accepts a valid payload with a slug", () => {
    const result = createOrganizationRequestSchema.safeParse({
      display_name: "Acme Weddings",
      slug: "acme-weddings",
      plan_id: "PLANNER_ESENCIAL",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a payload missing display_name", () => {
    const result = createOrganizationRequestSchema.safeParse({ plan_id: "PLANNER_ESENCIAL" });

    expect(result.success).toBe(false);
  });

  it("rejects an empty-string display_name", () => {
    const result = createOrganizationRequestSchema.safeParse({
      display_name: "",
      plan_id: "PLANNER_ESENCIAL",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only display_name", () => {
    const result = createOrganizationRequestSchema.safeParse({
      display_name: "   ",
      plan_id: "PLANNER_ESENCIAL",
    });

    expect(result.success).toBe(false);
  });

  it("trims a padded display_name", () => {
    const result = createOrganizationRequestSchema.safeParse({
      display_name: "  Acme Weddings  ",
      plan_id: "PLANNER_ESENCIAL",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.display_name).toBe("Acme Weddings");
  });

  it("rejects a whitespace-only display_name even when a valid slug is supplied", () => {
    const result = createOrganizationRequestSchema.safeParse({
      display_name: "   ",
      slug: "acme-weddings",
      plan_id: "PLANNER_ESENCIAL",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an empty-string slug", () => {
    const result = createOrganizationRequestSchema.safeParse({
      display_name: "Acme",
      slug: "",
      plan_id: "PLANNER_ESENCIAL",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a non-object payload", () => {
    const result = createOrganizationRequestSchema.safeParse(undefined);

    expect(result.success).toBe(false);
  });

  it("rejects a payload missing plan_id (STORY-004-001 — the plan is chosen at purchase, there is no default)", () => {
    const result = createOrganizationRequestSchema.safeParse({ display_name: "Acme" });

    expect(result.success).toBe(false);
  });

  it("rejects an unrecognized plan_id", () => {
    const result = createOrganizationRequestSchema.safeParse({
      display_name: "Acme",
      plan_id: "ENTERPRISE",
    });

    expect(result.success).toBe(false);
  });

  it("rejects plan_id EMPRENDEDOR (MASTER_SPEC §16.2 B2C per-event license, not a selectable B2B Organization plan)", () => {
    const result = createOrganizationRequestSchema.safeParse({
      display_name: "Acme",
      plan_id: "EMPRENDEDOR",
    });

    expect(result.success).toBe(false);
  });

  it.each([["PLANNER_ESENCIAL"], ["PLANNER_PROFESIONAL"], ["AGENCIA_ILIMITADA"]] as const)(
    "accepts plan_id %s",
    (planId) => {
      const result = createOrganizationRequestSchema.safeParse({
        display_name: "Acme",
        plan_id: planId,
      });

      expect(result.success).toBe(true);
    },
  );
});
