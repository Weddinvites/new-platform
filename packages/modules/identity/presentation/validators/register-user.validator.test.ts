import { describe, expect, it } from "vitest";
import { registerUserRequestSchema } from "./register-user.validator.ts";

describe("registerUserRequestSchema", () => {
  it("accepts a valid payload without an invitation token", () => {
    const result = registerUserRequestSchema.safeParse({
      email: "user@example.com",
      password: "a-valid-password",
      full_name: "Jane Doe",
    });

    expect(result.success).toBe(true);
  });

  it("accepts a valid payload with an invitation token", () => {
    const result = registerUserRequestSchema.safeParse({
      email: "user@example.com",
      password: "a-valid-password",
      full_name: "Jane Doe",
      invitation_token: "some-token",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a payload missing required fields", () => {
    const result = registerUserRequestSchema.safeParse({ email: "user@example.com" });

    expect(result.success).toBe(false);
  });

  it("rejects a non-object payload", () => {
    const result = registerUserRequestSchema.safeParse(undefined);

    expect(result.success).toBe(false);
  });
});
