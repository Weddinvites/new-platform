import type { MembershipStatus } from "../value-objects/membership-status";
import type { OrganizationRole } from "../value-objects/organization-role";

export type OrganizationMembershipProps = {
  id: string;
  userId: string;
  organizationId: string;
  role: OrganizationRole;
  status: MembershipStatus;
  createdAt: Date;
};

/**
 * Organization Membership (MASTER_SPEC §26.2a): links a User to an
 * Organization with a single canonical Role. A User may hold several
 * memberships (multi-organization membership, MASTER_SPEC §18; ADR-001).
 *
 * `status` (STORY-002-007) defaults to ACTIVE for every membership created
 * before this Story (registration, onboarding) and is otherwise only
 * transitioned by the Suspend/Activate/Remove User operations.
 */
export class OrganizationMembership {
  readonly id: string;
  readonly userId: string;
  readonly organizationId: string;
  readonly role: OrganizationRole;
  readonly status: MembershipStatus;
  readonly createdAt: Date;

  private constructor(props: OrganizationMembershipProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.organizationId = props.organizationId;
    this.role = props.role;
    this.status = props.status;
    this.createdAt = props.createdAt;
  }

  static create(params: {
    id: string;
    userId: string;
    organizationId: string;
    role: OrganizationRole;
    status?: MembershipStatus;
    createdAt?: Date;
  }): OrganizationMembership {
    return new OrganizationMembership({
      id: params.id,
      userId: params.userId,
      organizationId: params.organizationId,
      role: params.role,
      status: params.status ?? "ACTIVE",
      createdAt: params.createdAt ?? new Date(),
    });
  }

  static fromPersistence(props: OrganizationMembershipProps): OrganizationMembership {
    return new OrganizationMembership(props);
  }
}
