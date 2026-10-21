import { describe, expect, it } from "vitest";
import { retrieveSubscriptionParamsSchema } from "./retrieve-subscription.validator";

describe("retrieveSubscriptionParamsSchema", () => {
  it("accepts a well-formed UUID", () => {
    const result = retrieveSubscriptionParamsSchema.safeParse({
      organizationId: "11111111-1111-4111-8111-111111111111",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a malformed organizationId", () => {
    const result = retrieveSubscriptionParamsSchema.safeParse({ organizationId: "not-a-uuid" });

    expect(result.success).toBe(false);
  });

  it("rejects a missing organizationId", () => {
    const result = retrieveSubscriptionParamsSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("rejects a non-object payload", () => {
    const result = retrieveSubscriptionParamsSchema.safeParse(undefined);

    expect(result.success).toBe(false);
  });
});
