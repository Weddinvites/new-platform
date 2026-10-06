import { ok, type Result } from "@allinvites/kernel";
import { beforeEach, describe, expect, it } from "vitest";
import type { OrganizationMembership } from "../../domain/entities/organization-membership.ts";
import { User } from "../../domain/entities/user.ts";
import { AccountAlreadyExistsError } from "../../domain/exceptions/account-already-exists.error.ts";
import { InvalidEmailError } from "../../domain/exceptions/invalid-email.error.ts";
import { InvalidInvitationTokenError } from "../../domain/exceptions/invalid-invitation-token.error.ts";
import { InvalidPasswordError } from "../../domain/exceptions/invalid-password.error.ts";
import type { UserRepository } from "../../domain/repositories/user-repository.ts";
import { Email } from "../../domain/value-objects/email.ts";
import { FullName } from "../../domain/value-objects/full-name.ts";
import type { AuthProvider, AuthProviderError, CreatedAuthUser } from "../ports/auth-provider.ts";
import type { OrganizationLookupPort } from "../ports/organization-lookup.port.ts";
import { RegisterUserUseCase } from "./register-user.use-case.ts";

const SYSTEM_ORGANIZATION_ID = "22222222-2222-2222-2222-222222222222";

class FakeUserRepository implements UserRepository {
  private readonly usersByEmail = new Map<string, User>();
  saved: { user: User; membership: OrganizationMembership }[] = [];

  seed(user: User): void {
    this.usersByEmail.set(user.email.value, user);
  }

  async findByEmail(email: Email): Promise<User | null> {
    return this.usersByEmail.get(email.value) ?? null;
  }

  async findById(): Promise<User | null> {
    throw new Error("not used by RegisterUserUseCase tests");
  }

  async findMembershipsByUserId(): Promise<OrganizationMembership[]> {
    throw new Error("not used by RegisterUserUseCase tests");
  }

  async updateFullName(): Promise<User> {
    throw new Error("not used by RegisterUserUseCase tests");
  }

  async save(user: User, initialMembership: OrganizationMembership): Promise<void> {
    this.usersByEmail.set(user.email.value, user);
    this.saved.push({ user, membership: initialMembership });
  }
}

class FakeAuthProvider implements AuthProvider {
  result: Result<CreatedAuthUser, AuthProviderError> = ok({
    id: "11111111-1111-1111-1111-111111111111",
    session: { accessToken: "access-token", refreshToken: "refresh-token" },
  });
  calls: { email: string; password: string; fullName: string }[] = [];

  async createUser(params: {
    email: string;
    password: string;
    fullName: string;
  }): Promise<Result<CreatedAuthUser, AuthProviderError>> {
    this.calls.push(params);
    return this.result;
  }
}

class FakeOrganizationLookup implements OrganizationLookupPort {
  idBySlug: Record<string, string> = { system: SYSTEM_ORGANIZATION_ID };

  async findIdBySlug(slug: string): Promise<string | null> {
    return this.idBySlug[slug] ?? null;
  }
}

describe("RegisterUserUseCase", () => {
  let userRepository: FakeUserRepository;
  let authProvider: FakeAuthProvider;
  let organizationLookup: FakeOrganizationLookup;
  let useCase: RegisterUserUseCase;

  beforeEach(() => {
    userRepository = new FakeUserRepository();
    authProvider = new FakeAuthProvider();
    organizationLookup = new FakeOrganizationLookup();
    useCase = new RegisterUserUseCase(userRepository, authProvider, organizationLookup);
  });

  it("registers a new user with CLIENT role in the SYSTEM organization by default", async () => {
    const result = await useCase.execute({
      email: "user@example.com",
      password: "a-valid-password",
      fullName: "Jane Doe",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.user.email.value).toBe("user@example.com");
    expect(result.value.user.emailVerified).toBe(false);
    expect(result.value.membership.role).toBe("CLIENT");
    expect(result.value.membership.organizationId).toBe(SYSTEM_ORGANIZATION_ID);
    expect(result.value.session.accessToken).toBe("access-token");
    expect(result.value.event.type).toBe("UserRegistered");
    expect(userRepository.saved).toHaveLength(1);
  });

  it("passes the plaintext password to the auth provider, never to the repository", async () => {
    await useCase.execute({
      email: "user@example.com",
      password: "a-valid-password",
      fullName: "Jane Doe",
    });

    expect(authProvider.calls).toEqual([
      { email: "user@example.com", password: "a-valid-password", fullName: "Jane Doe" },
    ]);
  });

  it("rejects a duplicate account without calling the auth provider", async () => {
    userRepository.seed(
      User.register({
        id: "existing-user",
        email: Email.create("user@example.com"),
        fullName: FullName.create("Existing User"),
      }),
    );

    const result = await useCase.execute({
      email: "user@example.com",
      password: "a-valid-password",
      fullName: "Jane Doe",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(AccountAlreadyExistsError);
    expect(authProvider.calls).toHaveLength(0);
  });

  it("rejects an invalid email without calling the auth provider or repository", async () => {
    const result = await useCase.execute({
      email: "not-an-email",
      password: "a-valid-password",
      fullName: "Jane Doe",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(InvalidEmailError);
    expect(authProvider.calls).toHaveLength(0);
    expect(userRepository.saved).toHaveLength(0);
  });

  it("rejects a password shorter than 8 characters", async () => {
    const result = await useCase.execute({
      email: "user@example.com",
      password: "short",
      fullName: "Jane Doe",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(InvalidPasswordError);
  });

  it("rejects any supplied invitation_token, since no invitation system exists yet", async () => {
    const result = await useCase.execute({
      email: "user@example.com",
      password: "a-valid-password",
      fullName: "Jane Doe",
      invitationToken: "some-token",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(InvalidInvitationTokenError);
    expect(authProvider.calls).toHaveLength(0);
    expect(userRepository.saved).toHaveLength(0);
  });

  it("maps an EMAIL_ALREADY_REGISTERED auth provider error to AccountAlreadyExistsError", async () => {
    authProvider.result = { ok: false, error: { type: "EMAIL_ALREADY_REGISTERED" } };

    const result = await useCase.execute({
      email: "user@example.com",
      password: "a-valid-password",
      fullName: "Jane Doe",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(AccountAlreadyExistsError);
  });

  it("returns SYSTEM_ORGANIZATION_NOT_CONFIGURED when the SYSTEM organization is missing", async () => {
    organizationLookup.idBySlug = {};

    const result = await useCase.execute({
      email: "user@example.com",
      password: "a-valid-password",
      fullName: "Jane Doe",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "SYSTEM_ORGANIZATION_NOT_CONFIGURED" });
    expect(authProvider.calls).toHaveLength(0);
  });

  it("propagates an unexpected auth provider failure", async () => {
    authProvider.result = {
      ok: false,
      error: { type: "UNEXPECTED", cause: new Error("network down") },
    };

    const result = await useCase.execute({
      email: "user@example.com",
      password: "a-valid-password",
      fullName: "Jane Doe",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({ type: "UNEXPECTED" });
  });
});
