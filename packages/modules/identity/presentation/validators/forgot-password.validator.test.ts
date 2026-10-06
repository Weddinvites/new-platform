import { describe, expect, it } from "vitest";
import { forgotPasswordRequestSchema } from "./forgot-password.validator.ts";

describe("forgotPasswordRequestSchema", () => {
  it("accepts a valid payload", () => {
    const result = forgotPasswordRequestSchema.safeParse({ email: "user@example.com" });

    expect(result.success).toBe(true);
  });

  it("rejects a missing email", () => {
    const result = forgotPasswordRequestSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("rejects an empty-string email", () => {
    const result = forgotPasswordRequestSchema.safeParse({ email: "" });

    expect(result.success).toBe(false);
  });
});
