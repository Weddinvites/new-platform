import { describe, expect, it } from "vitest";
import { changePasswordRequestSchema } from "./change-password.validator.ts";

describe("changePasswordRequestSchema", () => {
  it("accepts a valid payload", () => {
    const result = changePasswordRequestSchema.safeParse({
      current_password: "the-current-password",
      new_password: "a-new-valid-password",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a missing current_password", () => {
    const result = changePasswordRequestSchema.safeParse({
      new_password: "a-new-valid-password",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a missing new_password", () => {
    const result = changePasswordRequestSchema.safeParse({
      current_password: "the-current-password",
    });

    expect(result.success).toBe(false);
  });
});
