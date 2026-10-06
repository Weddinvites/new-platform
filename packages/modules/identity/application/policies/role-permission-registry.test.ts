import { describe, expect, it } from "vitest";
import { RolePermissionRegistry } from "./role-permission-registry.ts";

describe("RolePermissionRegistry", () => {
  it("denies a permission that was never granted to any role (fail-secure default)", () => {
    const registry = new RolePermissionRegistry();

    expect(registry.hasPermission("ADMIN", "test:example")).toBe(false);
  });

  it("allows a permission after it has been granted to a role", () => {
    const registry = new RolePermissionRegistry();
    registry.grant("ADMIN", "test:example");

    expect(registry.hasPermission("ADMIN", "test:example")).toBe(true);
  });

  it("does not leak a grant to a different role", () => {
    const registry = new RolePermissionRegistry();
    registry.grant("ADMIN", "test:example");

    expect(registry.hasPermission("MEMBER", "test:example")).toBe(false);
    expect(registry.hasPermission("OWNER", "test:example")).toBe(false);
    expect(registry.hasPermission("CLIENT", "test:example")).toBe(false);
  });

  it("does not leak a grant to a different, ungranted permission on the same role", () => {
    const registry = new RolePermissionRegistry();
    registry.grant("ADMIN", "test:example-a");

    expect(registry.hasPermission("ADMIN", "test:example-b")).toBe(false);
  });

  it("supports multiple independent permissions granted to the same role", () => {
    const registry = new RolePermissionRegistry();
    registry.grant("OWNER", "test:example-a");
    registry.grant("OWNER", "test:example-b");

    expect(registry.hasPermission("OWNER", "test:example-a")).toBe(true);
    expect(registry.hasPermission("OWNER", "test:example-b")).toBe(true);
  });

  it("starts empty — no permission is pre-seeded for any canonical role", () => {
    const registry = new RolePermissionRegistry();

    for (const role of ["OWNER", "ADMIN", "MEMBER", "CLIENT"] as const) {
      expect(registry.hasPermission(role, "test:anything")).toBe(false);
    }
  });
});
