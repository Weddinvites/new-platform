import { describe, expect, it } from "vitest";
import { updateProfileRequestSchema } from "./update-profile.validator.ts";

describe("updateProfileRequestSchema", () => {
  it("accepts a valid payload", () => {
    const result = updateProfileRequestSchema.safeParse({ full_name: "Jane Doe" });

    expect(result.success).toBe(true);
  });

  it("rejects a missing full_name", () => {
    const result = updateProfileRequestSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("rejects an empty-string full_name", () => {
    const result = updateProfileRequestSchema.safeParse({ full_name: "" });

    expect(result.success).toBe(false);
  });
});
