import { describe, expect, it } from "vitest";
import { listOrganizationsQuerySchema } from "./list-organizations.validator";

describe("listOrganizationsQuerySchema", () => {
  it("defaults to page=1, pageSize=25 when omitted", () => {
    const result = listOrganizationsQuerySchema.safeParse({});

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({ page: 1, pageSize: 25 });
  });

  it("accepts explicit page/pageSize, coercing string query values", () => {
    const result = listOrganizationsQuerySchema.safeParse({ page: "2", pageSize: "50" });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({ page: 2, pageSize: 50 });
  });

  it("accepts the maximum pageSize of 100", () => {
    const result = listOrganizationsQuerySchema.safeParse({ pageSize: "100" });

    expect(result.success).toBe(true);
  });

  it("rejects a pageSize above 100", () => {
    const result = listOrganizationsQuerySchema.safeParse({ pageSize: "101" });

    expect(result.success).toBe(false);
  });

  it("rejects a non-positive page", () => {
    const result = listOrganizationsQuerySchema.safeParse({ page: "0" });

    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric page", () => {
    const result = listOrganizationsQuerySchema.safeParse({ page: "abc" });

    expect(result.success).toBe(false);
  });
});
