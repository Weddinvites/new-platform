import { ok, type Result } from "@allinvites/kernel";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  SessionError,
  SessionProvider,
  VerifiedIdentity,
} from "../../application/ports/session-provider.ts";
import { ResolveCurrentUserUseCase } from "../../application/use-cases/resolve-current-user.use-case.ts";
import { OrganizationMembership } from "../../domain/entities/organization-membership.ts";
import { User } from "../../domain/entities/user.ts";
import type { UserRepository } from "../../domain/repositories/user-repository.ts";
import { Email } from "../../domain/value-objects/email.ts";
import { FullName } from "../../domain/value-objects/full-name.ts";
import { createMeHandler } from "./me.handler.ts";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const ORGANIZATION_ID = "22222222-2222-2222-2222-222222222222";
const OTHER_ORGANIZATION_ID = "66666666-6666-6666-6666-666666666666";

class FakeSessionProvider implements SessionProvider {
  result: Result<VerifiedIdentity, SessionError> = ok({ id: USER_ID });

  async getUserFromAccessToken(): Promise<Result<VerifiedIdentity, SessionError>> {
    return this.result;
  }

  async refresh(): Promise<Result<never, SessionError>> {
    throw new Error("not used");
  }

  async revoke(): Promise<Result<void, SessionError>> {
    throw new Error("not used");
  }
}

describe("meHandler", () => {
  let handler: ReturnType<typeof createMeHandler>;
  let sessionProvider: FakeSessionProvider;

  beforeEach(() => {
    sessionProvider = new FakeSessionProvider();
    const userRepository: UserRepository = {
      findByEmail: async () => null,
      findById: async () =>
        User.fromPersistence({
          id: USER_ID,
          email: Email.create("user@example.com"),
          fullName: FullName.create("Jane Doe"),
          emailVerified: false,
          createdAt: new Date(),
        }),
      findMembershipsByUserId: async () => [
        OrganizationMembership.create({
          id: "33333333-3333-3333-3333-333333333333",
          userId: USER_ID,
          organizationId: ORGANIZATION_ID,
          role: "CLIENT",
        }),
      ],
      save: async () => {},
      updateFullName: async () => {
        throw new Error("not used by meHandler tests");
      },
    };
    const useCase = new ResolveCurrentUserUseCase(sessionProvider, userRepository);
    handler = createMeHandler(useCase);
  });

  it("returns 200 with the User and memberships for a valid Bearer token", async () => {
    const response = await handler("Bearer a-valid-access-token");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        id: USER_ID,
        email: "user@example.com",
        full_name: "Jane Doe",
        memberships: [{ organization_id: "22222222-2222-2222-2222-222222222222", role: "CLIENT" }],
      },
    });
  });

  it("returns every membership, correctly attributed, for a user belonging to multiple organizations", async () => {
    const userRepository: UserRepository = {
      findByEmail: async () => null,
      findById: async () =>
        User.fromPersistence({
          id: USER_ID,
          email: Email.create("user@example.com"),
          fullName: FullName.create("Jane Doe"),
          emailVerified: false,
          createdAt: new Date(),
        }),
      findMembershipsByUserId: async () => [
        OrganizationMembership.create({
          id: "33333333-3333-3333-3333-333333333333",
          userId: USER_ID,
          organizationId: ORGANIZATION_ID,
          role: "ADMIN",
        }),
        OrganizationMembership.create({
          id: "77777777-7777-7777-7777-777777777777",
          userId: USER_ID,
          organizationId: OTHER_ORGANIZATION_ID,
          role: "OWNER",
        }),
      ],
      save: async () => {},
      updateFullName: async () => {
        throw new Error("not used by meHandler tests");
      },
    };
    const multiMembershipHandler = createMeHandler(
      new ResolveCurrentUserUseCase(sessionProvider, userRepository),
    );

    const response = await multiMembershipHandler("Bearer a-valid-access-token");

    expect(response.status).toBe(200);
    const body = response.body as {
      success: boolean;
      data: {
        id: string;
        email: string;
        full_name: string;
        memberships: Array<{ organization_id: string; role: string }>;
      };
    };

    // Identity fields remain correct alongside multiple memberships.
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(USER_ID);
    expect(body.data.email).toBe("user@example.com");
    expect(body.data.full_name).toBe("Jane Doe");

    // Neither membership is dropped, duplicated, or merged.
    expect(body.data.memberships).toHaveLength(2);

    // Each membership preserves its own (organization_id, role) pairing.
    expect(body.data.memberships).toEqual(
      expect.arrayContaining([
        { organization_id: ORGANIZATION_ID, role: "ADMIN" },
        { organization_id: OTHER_ORGANIZATION_ID, role: "OWNER" },
      ]),
    );

    // No organization_id appears more than once (no accidental overwrite/merge).
    const organizationIds = body.data.memberships.map((m) => m.organization_id);
    expect(new Set(organizationIds).size).toBe(2);
  });

  it("does not include email_verified in the response (undocumented for this endpoint)", async () => {
    const response = await handler("Bearer a-valid-access-token");

    expect(response.body).not.toHaveProperty("data.email_verified");
  });

  it("returns 401 UNAUTHORIZED when no Authorization header is present", async () => {
    const response = await handler(null);

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication is required." },
    });
  });

  it("returns 401 UNAUTHORIZED for a malformed Authorization header", async () => {
    const response = await handler("not-a-bearer-token");

    expect(response.status).toBe(401);
  });

  it("returns 401 UNAUTHORIZED when the access token is invalid or expired", async () => {
    sessionProvider.result = { ok: false, error: { type: "UNAUTHORIZED" } };

    const response = await handler("Bearer an-expired-token");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "UNAUTHORIZED" },
    });
  });

  it("returns 500 without leaking provider details on an unexpected failure", async () => {
    sessionProvider.result = {
      ok: false,
      error: { type: "UNEXPECTED", cause: new Error("db is down") },
    };

    const response = await handler("Bearer a-valid-access-token");

    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain("db is down");
  });
});
