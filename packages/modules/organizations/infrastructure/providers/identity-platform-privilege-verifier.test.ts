import { err, ok } from "@allinvites/kernel";
import type { VerifyPlatformPrivilegeService } from "@allinvites/module-identity";
import { describe, expect, it } from "vitest";
import { Organization } from "../../domain/entities/organization";
import { Slug } from "../../domain/value-objects/slug";
import { createIdentityPlatformPrivilegeVerifier } from "./identity-platform-privilege-verifier";

const SYSTEM_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "11111111-1111-4111-8111-111111111111";

function systemOrganization(): Organization {
  return Organization.fromPersistence({
    id: SYSTEM_ID,
    organizationType: "SYSTEM",
    slug: Slug.fromPersistence("agencia-0"),
    displayName: "Agencia 0",
    createdAt: new Date(),
  });
}

describe("createIdentityPlatformPrivilegeVerifier (STORY-003-004)", () => {
  it("passes the resolved SYSTEM organization id to Identity and returns true on success", async () => {
    const calls: unknown[] = [];
    const verify: VerifyPlatformPrivilegeService = async (params) => {
      calls.push(params);
      return ok(undefined);
    };
    const verifier = createIdentityPlatformPrivilegeVerifier(
      { findSystemOrganization: async () => systemOrganization() },
      verify,
    );

    expect(await verifier({ userId: USER_ID })).toBe(true);
    expect(calls).toEqual([{ userId: USER_ID, systemOrganizationId: SYSTEM_ID }]);
  });

  it("returns false for NOT_PLATFORM_PRIVILEGED", async () => {
    const verifier = createIdentityPlatformPrivilegeVerifier(
      { findSystemOrganization: async () => systemOrganization() },
      async () => err({ type: "NOT_PLATFORM_PRIVILEGED" }),
    );

    expect(await verifier({ userId: USER_ID })).toBe(false);
  });

  it("returns false without calling Identity when no SYSTEM organization exists", async () => {
    let called = false;
    const verifier = createIdentityPlatformPrivilegeVerifier(
      { findSystemOrganization: async () => null },
      async () => {
        called = true;
        return ok(undefined);
      },
    );

    expect(await verifier({ userId: USER_ID })).toBe(false);
    expect(called).toBe(false);
  });

  it("rethrows the cause on an Identity UNEXPECTED failure instead of treating it as not privileged", async () => {
    const cause = new Error("db down");
    const verifier = createIdentityPlatformPrivilegeVerifier(
      { findSystemOrganization: async () => systemOrganization() },
      async () => err({ type: "UNEXPECTED", cause }),
    );

    await expect(verifier({ userId: USER_ID })).rejects.toBe(cause);
  });
});
