import { describe, expect, it } from "vitest";
import { extractBearerToken } from "./extract-bearer-token.ts";

describe("extractBearerToken", () => {
  it("extracts the token from a well-formed Authorization header", () => {
    expect(extractBearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
  });

  it("is case-insensitive on the Bearer prefix", () => {
    expect(extractBearerToken("bearer abc.def.ghi")).toBe("abc.def.ghi");
  });

  it("returns null for a missing header", () => {
    expect(extractBearerToken(null)).toBeNull();
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it("returns null for a header without the Bearer scheme", () => {
    expect(extractBearerToken("abc.def.ghi")).toBeNull();
  });

  it("returns null for a Bearer header with no token", () => {
    expect(extractBearerToken("Bearer ")).toBeNull();
    expect(extractBearerToken("Bearer")).toBeNull();
  });
});
