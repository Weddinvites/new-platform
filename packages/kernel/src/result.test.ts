import { describe, expect, it } from "vitest";
import { err, isErr, isOk, ok } from "./result.ts";

describe("Result", () => {
  it("creates a successful result", () => {
    const result = ok(42);

    expect(isOk(result)).toBe(true);
    expect(isErr(result)).toBe(false);
    if (isOk(result)) {
      expect(result.value).toBe(42);
    }
  });

  it("creates a failed result", () => {
    const result = err("something went wrong");

    expect(isErr(result)).toBe(true);
    expect(isOk(result)).toBe(false);
    if (isErr(result)) {
      expect(result.error).toBe("something went wrong");
    }
  });
});
