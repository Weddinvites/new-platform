import { describe, expect, it } from "vitest";
import { refreshSessionRequestSchema } from "./refresh-session.validator.ts";

describe("refreshSessionRequestSchema", () => {
  it("accepts a valid refresh payload", () => {
    const result = refreshSessionRequestSchema.safeParse({ refresh_token: "a-refresh-token" });

    expect(result.success).toBe(true);
  });

  it("rejects a missing refresh_token", () => {
    const result = refreshSessionRequestSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("rejects an empty-string refresh_token", () => {
    const result = refreshSessionRequestSchema.safeParse({ refresh_token: "" });

    expect(result.success).toBe(false);
  });
});
