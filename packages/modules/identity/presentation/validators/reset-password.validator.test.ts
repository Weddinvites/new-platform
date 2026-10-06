import { describe, expect, it } from "vitest";
import { resetPasswordRequestSchema } from "./reset-password.validator.ts";

describe("resetPasswordRequestSchema", () => {
  it("accepts a valid payload", () => {
    const result = resetPasswordRequestSchema.safeParse({
      email: "user@example.com",
      token: "a-recovery-token",
      password: "a-valid-password",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a missing email", () => {
    const result = resetPasswordRequestSchema.safeParse({
      token: "a-recovery-token",
      password: "a-valid-password",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a missing token", () => {
    const result = resetPasswordRequestSchema.safeParse({
      email: "user@example.com",
      password: "a-valid-password",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a missing password", () => {
    const result = resetPasswordRequestSchema.safeParse({
      email: "user@example.com",
      token: "a-recovery-token",
    });

    expect(result.success).toBe(false);
  });
});
