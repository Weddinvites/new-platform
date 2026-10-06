import { describe, expect, it } from "vitest";
import { InvalidFullNameError } from "../exceptions/invalid-full-name.error.ts";
import { FullName } from "./full-name.ts";

describe("FullName", () => {
  it("trims surrounding whitespace", () => {
    const fullName = FullName.create("  Jane Doe  ");

    expect(fullName.value).toBe("Jane Doe");
  });

  it("rejects an empty value", () => {
    expect(() => FullName.create("   ")).toThrow(InvalidFullNameError);
  });

  it("rejects a value longer than 200 characters", () => {
    expect(() => FullName.create("a".repeat(201))).toThrow(InvalidFullNameError);
  });
});
