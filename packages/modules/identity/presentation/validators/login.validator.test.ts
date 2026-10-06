import { describe, expect, it } from "vitest";
import { loginRequestSchema } from "./login.validator.ts";

describe("loginRequestSchema", () => {
  it("accepts a valid login payload", () => {
    const result = loginRequestSchema.safeParse({
      email: "user@example.com",
      password: "whatever-password",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a missing email", () => {
    const result = loginRequestSchema.safeParse({ password: "whatever-password" });

    expect(result.success).toBe(false);
  });

  it("rejects a missing password", () => {
    const result = loginRequestSchema.safeParse({ email: "user@example.com" });

    expect(result.success).toBe(false);
  });

  it("rejects an empty-string password", () => {
    const result = loginRequestSchema.safeParse({ email: "user@example.com", password: "" });

    expect(result.success).toBe(false);
  });
});
