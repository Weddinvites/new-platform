import type { Transaction } from "@allinvites/database";
import type { OrganizationMembership } from "../entities/organization-membership";
import type { User } from "../entities/user";
import type { MembershipStatus } from "../value-objects/membership-status";
import type { OrganizationRole } from "../value-objects/organization-role";

export type MembershipWithUser = {
  readonly membership: OrganizationMembership;
  readonly user: User;
};

export type ListOrganizationMembersResult = {
  readonly items: MembershipWithUser[];
  readonly total: number;
};

/**
 * Repository interface (domain-owned port) for STORY-002-007's team
 * management operations. Separate from UserRepository (Interface
 * Segregation): UserRepository owns the User aggregate's own
 * identity/profile fields; this port owns Organization Membership
 * lifecycle/role state and organization-scoped membership queries, so
 * STORY-002-007 never needs to touch UserRepository's existing contract.
 * Implemented by DrizzleOrganizationMembershipRepository in the
 * Infrastructure layer.
 */
export interface OrganizationMembershipRepository {
  /**
   * STORY-003-001 (Organizations) — inserts a new membership row within a
   * transaction opened by the caller, so it can participate atomically in a
   * cross-module write (e.g. Organization creation + initial OWNER
   * membership) without a second transaction mechanism (ADR-011).
   */
  create(membership: OrganizationMembership, tx: Transaction): Promise<void>;

  /** Resolves the caller's own membership for organization-context checks. */
  findByUserAndOrganization(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationMembership | null>;

  /** Resolves a target member together with their User profile, scoped to one organization. */
  findMemberWithUser(userId: string, organizationId: string): Promise<MembershipWithUser | null>;

  listByOrganization(
    organizationId: string,
    pagination: { page: number; pageSize: number },
  ): Promise<ListOrganizationMembersResult>;

  /** Count of ACTIVE OWNER memberships in the organization — last-owner invariant. */
  countActiveOwners(organizationId: string): Promise<number>;

  updateStatus(membershipId: string, status: MembershipStatus): Promise<OrganizationMembership>;

  updateRole(membershipId: string, role: OrganizationRole): Promise<OrganizationMembership>;
}
