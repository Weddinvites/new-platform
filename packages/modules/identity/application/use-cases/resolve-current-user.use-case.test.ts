import { err, ok, type Result } from "@allinvites/kernel";
import { beforeEach, describe, expect, it } from "vitest";
import { OrganizationMembership } from "../../domain/entities/organization-membership.ts";
import { User } from "../../domain/entities/user.ts";
import { Email } from "../../domain/value-objects/email.ts";
import { FullName } from "../../domain/value-objects/full-name.ts";
import type { SessionError, SessionProvider, VerifiedIdentity } from "../ports/session-provider.ts";
import { ResolveCurrentUserUseCase } from "./resolve-current-user.use-case.ts";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const ORGANIZATION_ID = "22222222-2222-2222-2222-222222222222";
const OTHER_ORGANIZATION_ID = "44444444-4444-4444-4444-444444444444";

class FakeSessionProvider implements SessionProvider {
  result: Result<VerifiedIdentity, SessionError> = ok({ id: USER_ID });

  async getUserFromAccessToken(): Promise<Result<VerifiedIdentity, SessionError>> {
    return this.result;
  }

  async refresh(): Promise<Result<never, SessionError>> {
    throw new Error("not used by ResolveCurrentUserUseCase tests");
  }

  async revoke(): Promise<Result<void, SessionError>> {
    throw new Error("not used by ResolveCurrentUserUseCase tests");
  }
}

describe("ResolveCurrentUserUseCase", () => {
  let sessionProvider: FakeSessionProvider;
  let user: User | null;
  let memberships: OrganizationMembership[];
  let useCase: ResolveCurrentUserUseCase;

  beforeEach(() => {
    sessionProvider = new FakeSessionProvider();
    user = User.fromPersistence({
      id: USER_ID,
      email: Email.create("user@example.com"),
      fullName: FullName.create("Jane Doe"),
      emailVerified: false,
      createdAt: new Date(),
    });
    memberships = [
      OrganizationMembership.create({
        id: "33333333-3333-3333-3333-333333333333",
        userId: USER_ID,
        organizationId: ORGANIZATION_ID,
        role: "CLIENT",
      }),
    ];

    useCase = new ResolveCurrentUserUseCase(sessionProvider, {
      findByEmail: async () => null,
      findById: async (id: string) => (id === USER_ID ? user : null),
      findMembershipsByUserId: async (userId: string) => (userId === USER_ID ? memberships : []),
      save: async () => {},
      updateFullName: async () => {
        throw new Error("not used by ResolveCurrentUserUseCase tests");
      },
    });
  });

  it("returns the User and their memberships for a valid access token", async () => {
    const result = await useCase.execute("valid-access-token");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.user.id).toBe(USER_ID);
    expect(result.value.memberships).toHaveLength(1);
    expect(result.value.memberships[0]?.role).toBe("CLIENT");
  });

  it("returns every membership, correctly attributed, for a user belonging to multiple organizations", async () => {
    memberships = [
      OrganizationMembership.create({
        id: "33333333-3333-3333-3333-333333333333",
        userId: USER_ID,
        organizationId: ORGANIZATION_ID,
        role: "ADMIN",
      }),
      OrganizationMembership.create({
        id: "55555555-5555-5555-5555-555555555555",
        userId: USER_ID,
        organizationId: OTHER_ORGANIZATION_ID,
        role: "OWNER",
      }),
    ];

    const result = await useCase.execute("valid-access-token");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Identity fields remain correct regardless of membership count.
    expect(result.value.user.id).toBe(USER_ID);
    expect(result.value.user.email.value).toBe("user@example.com");
    expect(result.value.user.fullName.value).toBe("Jane Doe");

    // Neither membership is dropped, duplicated, or merged.
    expect(result.value.memberships).toHaveLength(2);

    // Each membership preserves its own (organization_id, role) pairing —
    // not swapped or overwritten by the other.
    const forOrgOne = result.value.memberships.find((m) => m.organizationId === ORGANIZATION_ID);
    const forOrgTwo = result.value.memberships.find(
      (m) => m.organizationId === OTHER_ORGANIZATION_ID,
    );
    expect(forOrgOne?.role).toBe("ADMIN");
    expect(forOrgTwo?.role).toBe("OWNER");

    // No membership is associated with an organization it doesn't belong to.
    expect(result.value.memberships.every((m) => m.userId === USER_ID)).toBe(true);
    expect(new Set(result.value.memberships.map((m) => m.organizationId)).size).toBe(2);
  });

  it("returns UNAUTHORIZED for an invalid/expired access token", async () => {
    sessionProvider.result = err({ type: "UNAUTHORIZED" });

    const result = await useCase.execute("invalid-access-token");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "UNAUTHORIZED" });
  });

  it("returns UNEXPECTED, not UNAUTHORIZED, when the provider fails technically", async () => {
    sessionProvider.result = err({ type: "UNEXPECTED", cause: new Error("network down") });

    const result = await useCase.execute("some-token");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });

  it("returns UNEXPECTED (not UNAUTHORIZED) when no local profile matches a validly authenticated token", async () => {
    user = null;

    const result = await useCase.execute("valid-access-token");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });
});
