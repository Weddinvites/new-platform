import { describe, expect, it } from "vitest";
import { OrganizationMembership } from "../../domain/entities/organization-membership.ts";
import type { OrganizationRole } from "../../domain/value-objects/organization-role.ts";
import { AuthorizationPolicy } from "./authorization-policy.ts";
import { RolePermissionRegistry } from "./role-permission-registry.ts";

function membershipWithRole(role: OrganizationRole): OrganizationMembership {
  return OrganizationMembership.create({
    id: "33333333-3333-3333-3333-333333333333",
    userId: "11111111-1111-1111-1111-111111111111",
    organizationId: "22222222-2222-2222-2222-222222222222",
    role,
  });
}

describe("AuthorizationPolicy", () => {
  it("denies when the registry has no grant for the membership's role (fail-secure)", () => {
    const policy = new AuthorizationPolicy(new RolePermissionRegistry());

    expect(policy.authorize(membershipWithRole("ADMIN"), "test:example")).toBe(false);
  });

  it("allows when the registry grants the membership's role the requested permission", () => {
    const registry = new RolePermissionRegistry();
    registry.grant("ADMIN", "test:example");
    const policy = new AuthorizationPolicy(registry);

    expect(policy.authorize(membershipWithRole("ADMIN"), "test:example")).toBe(true);
  });

  it("resolves the role from the given membership, not a global/bare role", () => {
    const registry = new RolePermissionRegistry();
    registry.grant("OWNER", "test:example");
    const policy = new AuthorizationPolicy(registry);

    expect(policy.authorize(membershipWithRole("OWNER"), "test:example")).toBe(true);
    expect(policy.authorize(membershipWithRole("CLIENT"), "test:example")).toBe(false);
  });

  it("denies every role against a completely empty registry", () => {
    const policy = new AuthorizationPolicy(new RolePermissionRegistry());

    for (const role of ["OWNER", "ADMIN", "MEMBER", "CLIENT"] as const) {
      expect(policy.authorize(membershipWithRole(role), "test:anything")).toBe(false);
    }
  });
});
