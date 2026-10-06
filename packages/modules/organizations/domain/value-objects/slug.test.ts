import { describe, expect, it } from "vitest";
import { InvalidSlugError } from "../exceptions/invalid-slug.error";
import { Slug } from "./slug";

describe("Slug", () => {
  it("lowercases and kebab-cases a display-name-like string", () => {
    expect(Slug.create("My Cool Org").value).toBe("my-cool-org");
  });

  it("collapses runs of non-alphanumeric characters into a single hyphen", () => {
    expect(Slug.create("  Acme & Co.!!  ").value).toBe("acme-co");
  });

  it("trims leading and trailing hyphens produced by normalization", () => {
    expect(Slug.create("---acme---").value).toBe("acme");
  });

  it("leaves an already-normalized slug unchanged", () => {
    expect(Slug.create("already-kebab-case").value).toBe("already-kebab-case");
  });

  it("throws InvalidSlugError when normalization yields an empty string", () => {
    expect(() => Slug.create("!!!")).toThrow(InvalidSlugError);
    expect(() => Slug.create("   ")).toThrow(InvalidSlugError);
  });

  it("fromPersistence preserves an already-normalized value verbatim", () => {
    expect(Slug.fromPersistence("acme").value).toBe("acme");
  });
});
