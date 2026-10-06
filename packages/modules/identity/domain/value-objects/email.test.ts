import { describe, expect, it } from "vitest";
import { InvalidEmailError } from "../exceptions/invalid-email.error.ts";
import { Email } from "./email.ts";

describe("Email", () => {
  it("accepts a valid email and normalizes it to lowercase", () => {
    const email = Email.create("  User@Example.com  ");

    expect(email.value).toBe("user@example.com");
  });

  it("rejects a value without an @", () => {
    expect(() => Email.create("not-an-email")).toThrow(InvalidEmailError);
  });

  it("rejects a value without a domain", () => {
    expect(() => Email.create("user@")).toThrow(InvalidEmailError);
  });

  it("treats two emails differing only by case as equal", () => {
    const a = Email.create("user@example.com");
    const b = Email.create("USER@EXAMPLE.COM");

    expect(a.equals(b)).toBe(true);
  });
});
