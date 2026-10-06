import { describe, expect, it } from "vitest";
import { retrieveOrganizationParamsSchema } from "./retrieve-organization.validator";

describe("retrieveOrganizationParamsSchema", () => {
  it("accepts a well-formed UUID", () => {
    const result = retrieveOrganizationParamsSchema.safeParse({
      organizationId: "11111111-1111-4111-8111-111111111111",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a malformed organizationId", () => {
    const result = retrieveOrganizationParamsSchema.safeParse({ organizationId: "not-a-uuid" });

    expect(result.success).toBe(false);
  });

  it("rejects a missing organizationId", () => {
    const result = retrieveOrganizationParamsSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("rejects a non-object payload", () => {
    const result = retrieveOrganizationParamsSchema.safeParse(undefined);

    expect(result.success).toBe(false);
  });
});
