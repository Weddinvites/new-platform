import { ok, type Result } from "@allinvites/kernel";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  AuthProvider,
  AuthProviderError,
  CreatedAuthUser,
} from "../../application/ports/auth-provider.ts";
import type { OrganizationLookupPort } from "../../application/ports/organization-lookup.port.ts";
import { RegisterUserUseCase } from "../../application/use-cases/register-user.use-case.ts";
import type { OrganizationMembership } from "../../domain/entities/organization-membership.ts";
import type { User } from "../../domain/entities/user.ts";
import type { UserRepository } from "../../domain/repositories/user-repository.ts";
import type { Email } from "../../domain/value-objects/email.ts";
import { createRegisterUserHandler } from "./register-user.handler.ts";

const SYSTEM_ORGANIZATION_ID = "22222222-2222-2222-2222-222222222222";

class FakeUserRepository implements UserRepository {
  private readonly usersByEmail = new Map<string, User>();

  async findByEmail(email: Email): Promise<User | null> {
    return this.usersByEmail.get(email.value) ?? null;
  }

  async findById(): Promise<User | null> {
    throw new Error("not used by registerUserHandler tests");
  }

  async findMembershipsByUserId(): Promise<OrganizationMembership[]> {
    throw new Error("not used by registerUserHandler tests");
  }

  async updateFullName(): Promise<User> {
    throw new Error("not used by registerUserHandler tests");
  }

  async save(user: User, _initialMembership: OrganizationMembership): Promise<void> {
    this.usersByEmail.set(user.email.value, user);
  }
}

class FakeAuthProvider implements AuthProvider {
  result: Result<CreatedAuthUser, AuthProviderError> = ok({
    id: "11111111-1111-1111-1111-111111111111",
    session: { accessToken: "access-token", refreshToken: "refresh-token" },
  });

  async createUser(): Promise<Result<CreatedAuthUser, AuthProviderError>> {
    return this.result;
  }
}

class FakeOrganizationLookup implements OrganizationLookupPort {
  async findIdBySlug(): Promise<string | null> {
    return SYSTEM_ORGANIZATION_ID;
  }
}

describe("registerUserHandler", () => {
  let handler: ReturnType<typeof createRegisterUserHandler>;
  let authProvider: FakeAuthProvider;

  beforeEach(() => {
    authProvider = new FakeAuthProvider();
    const useCase = new RegisterUserUseCase(
      new FakeUserRepository(),
      authProvider,
      new FakeOrganizationLookup(),
    );
    handler = createRegisterUserHandler(useCase);
  });

  it("returns 201 with the registered user on success", async () => {
    const response = await handler({
      email: "user@example.com",
      password: "a-valid-password",
      full_name: "Jane Doe",
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      data: { email: "user@example.com", email_verified: false, memberships: [{ role: "CLIENT" }] },
    });
  });

  it("returns 422 VALIDATION_ERROR for a malformed body", async () => {
    const response = await handler({ email: "user@example.com" });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("returns 409 ACCOUNT_ALREADY_EXISTS on duplicate registration", async () => {
    authProvider.result = { ok: false, error: { type: "EMAIL_ALREADY_REGISTERED" } };

    const response = await handler({
      email: "user@example.com",
      password: "a-valid-password",
      full_name: "Jane Doe",
    });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "ACCOUNT_ALREADY_EXISTS" },
    });
  });

  it("returns 400 INVALID_OR_EXPIRED_TOKEN when an invitation_token is supplied", async () => {
    const response = await handler({
      email: "user@example.com",
      password: "a-valid-password",
      full_name: "Jane Doe",
      invitation_token: "some-token",
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "INVALID_OR_EXPIRED_TOKEN" },
    });
  });

  it("returns 500 without leaking details on an unexpected failure", async () => {
    authProvider.result = {
      ok: false,
      error: { type: "UNEXPECTED", cause: new Error("db is down") },
    };

    const response = await handler({
      email: "user@example.com",
      password: "a-valid-password",
      full_name: "Jane Doe",
    });

    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain("db is down");
  });
});
