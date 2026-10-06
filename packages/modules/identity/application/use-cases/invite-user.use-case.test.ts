import { err } from "@allinvites/kernel";
import { beforeEach, describe, expect, it } from "vitest";
import { Invitation } from "../../domain/entities/invitation";
import { InvalidEmailError } from "../../domain/exceptions/invalid-email.error";
import { InvitationAlreadyPendingError } from "../../domain/exceptions/invitation-already-pending.error";
import type { InvitationRepository } from "../../domain/repositories/invitation-repository";
import { Email } from "../../domain/value-objects/email";
import { AuthorizationPolicy } from "../policies/authorization-policy";
import { createTeamManagementAuthorizationPolicy } from "../policies/create-team-management-authorization-policy";
import { RolePermissionRegistry } from "../policies/role-permission-registry";
import type { InvitationDeliveryProvider } from "../ports/invitation-delivery-provider";
import { InviteUserUseCase } from "./invite-user.use-case";
import {
  buildMembership,
  CALLER_ID,
  FakeOrganizationMembershipRepository,
  FakeSessionProvider,
  ORGANIZATION_ID,
} from "./team-management-test-fakes";

class FakeInvitationRepository implements InvitationRepository {
  existingPending: Invitation | null = null;
  saveCalls: Invitation[] = [];

  async findActivePendingByOrganizationAndEmail(): Promise<Invitation | null> {
    return this.existingPending;
  }

  async save(invitation: Invitation): Promise<void> {
    this.saveCalls.push(invitation);
  }
}

class FakeInvitationDeliveryProvider implements InvitationDeliveryProvider {
  calls: { email: string; token: string }[] = [];

  async deliver(params: { email: string; token: string }): Promise<void> {
    this.calls.push({ email: params.email, token: params.token });
  }
}

describe("InviteUserUseCase", () => {
  let sessionProvider: FakeSessionProvider;
  let membershipRepository: FakeOrganizationMembershipRepository;
  let invitationRepository: FakeInvitationRepository;
  let deliveryProvider: FakeInvitationDeliveryProvider;
  let useCase: InviteUserUseCase;

  beforeEach(() => {
    sessionProvider = new FakeSessionProvider();
    membershipRepository = new FakeOrganizationMembershipRepository();
    invitationRepository = new FakeInvitationRepository();
    deliveryProvider = new FakeInvitationDeliveryProvider();
    useCase = new InviteUserUseCase(
      sessionProvider,
      membershipRepository,
      createTeamManagementAuthorizationPolicy(),
      invitationRepository,
      deliveryProvider,
    );
  });

  it("creates a pending invitation when the caller is an OWNER", async () => {
    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      email: "new-member@example.com",
      role: "MEMBER",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.invitation.status).toBe("PENDING");
    expect(result.value.invitation.email.value).toBe("new-member@example.com");
    expect(result.value.event).toMatchObject({ type: "UserInvited", role: "MEMBER" });
    expect(invitationRepository.saveCalls).toHaveLength(1);
    expect(deliveryProvider.calls).toHaveLength(1);
    // The raw token must never be persisted — only the invitation's hash.
    expect(invitationRepository.saveCalls[0]?.tokenHash).not.toBe(deliveryProvider.calls[0]?.token);
  });

  it("returns UNAUTHORIZED for a missing/invalid session", async () => {
    sessionProvider.identityResult = err({ type: "UNAUTHORIZED" });

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      email: "new-member@example.com",
      role: "MEMBER",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "UNAUTHORIZED" });
  });

  it("returns FORBIDDEN when the caller has no membership in the organization", async () => {
    membershipRepository.callerMembership = null;

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      email: "new-member@example.com",
      role: "MEMBER",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "FORBIDDEN" });
  });

  it("returns FORBIDDEN when the caller's membership is SUSPENDED", async () => {
    membershipRepository.callerMembership = buildMembership({ role: "OWNER", status: "SUSPENDED" });

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      email: "new-member@example.com",
      role: "MEMBER",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "FORBIDDEN" });
  });

  it.each(["ADMIN", "MEMBER", "CLIENT"] as const)(
    "returns FORBIDDEN for a %s caller (only OWNER may invite)",
    async (role) => {
      membershipRepository.callerMembership = buildMembership({ role });

      const result = await useCase.execute("token", {
        organizationId: ORGANIZATION_ID,
        email: "new-member@example.com",
        role: "MEMBER",
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toEqual({ type: "FORBIDDEN" });
    },
  );

  it("denies invitation when a fresh registry grants nothing (fail-secure)", async () => {
    const emptyPolicyUseCase = new InviteUserUseCase(
      sessionProvider,
      membershipRepository,
      new AuthorizationPolicy(new RolePermissionRegistry()),
      invitationRepository,
      deliveryProvider,
    );

    const result = await emptyPolicyUseCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      email: "new-member@example.com",
      role: "MEMBER",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "FORBIDDEN" });
  });

  it("rejects an invalid email", async () => {
    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      email: "not-an-email",
      role: "MEMBER",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(InvalidEmailError);
    expect(invitationRepository.saveCalls).toHaveLength(0);
  });

  it("returns InvitationAlreadyPendingError when a pending invitation already exists", async () => {
    invitationRepository.existingPending = Invitation.create({
      id: "existing-invitation-id",
      organizationId: ORGANIZATION_ID,
      email: Email.create("new-member@example.com"),
      role: "MEMBER",
      tokenHash: "existing-hash",
      invitedBy: CALLER_ID,
    });

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      email: "new-member@example.com",
      role: "MEMBER",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(InvitationAlreadyPendingError);
    expect(invitationRepository.saveCalls).toHaveLength(0);
  });

  it("allows a new invitation once the previous PENDING one has expired", async () => {
    invitationRepository.existingPending = Invitation.fromPersistence({
      id: "expired-invitation-id",
      organizationId: ORGANIZATION_ID,
      email: Email.create("new-member@example.com"),
      role: "MEMBER",
      tokenHash: "expired-hash",
      status: "PENDING",
      invitedBy: CALLER_ID,
      createdAt: new Date("2020-01-01T00:00:00Z"),
      expiresAt: new Date("2020-01-08T00:00:00Z"),
      acceptedAt: null,
    });

    const result = await useCase.execute("token", {
      organizationId: ORGANIZATION_ID,
      email: "new-member@example.com",
      role: "MEMBER",
    });

    expect(result.ok).toBe(true);
    expect(invitationRepository.saveCalls).toHaveLength(1);
  });
});
