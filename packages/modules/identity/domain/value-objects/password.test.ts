import { describe, expect, it } from "vitest";
import { InvalidPasswordError } from "../exceptions/invalid-password.error.ts";
import { Password } from "./password.ts";

describe("Password", () => {
  it("accepts a password within the 8-72 character range", () => {
    const password = Password.create("a-valid-password");

    expect(password.value).toBe("a-valid-password");
  });

  it("accepts exactly 8 characters", () => {
    expect(() => Password.create("12345678")).not.toThrow();
  });

  it("rejects fewer than 8 characters", () => {
    expect(() => Password.create("1234567")).toThrow(InvalidPasswordError);
  });

  it("accepts exactly 72 characters", () => {
    expect(() => Password.create("a".repeat(72))).not.toThrow();
  });

  it("rejects more than 72 characters", () => {
    expect(() => Password.create("a".repeat(73))).toThrow(InvalidPasswordError);
  });

  it("never exposes the plaintext value through toString", () => {
    const password = Password.create("super-secret-password");

    expect(password.toString()).toBe("[REDACTED]");
    expect(String(password)).not.toContain("super-secret-password");
  });
});
