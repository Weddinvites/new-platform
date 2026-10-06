import type { Email } from "../value-objects/email";
import type { InvitationStatus } from "../value-objects/invitation-status";
import type { OrganizationRole } from "../value-objects/organization-role";

export type InvitationProps = {
  id: string;
  organizationId: string;
  email: Email;
  role: OrganizationRole;
  tokenHash: string;
  status: InvitationStatus;
  invitedBy: string;
  createdAt: Date;
  expiresAt: Date;
  acceptedAt: Date | null;
};

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Invitation aggregate (STORY-002-007 — Invite User). Represents a pending
 * offer for a person to join an Organization with a specific Role, consumed
 * by a future, explicitly approved change to `POST /auth/register`
 * (API_SPEC.md §21a). Only the token's hash is ever persisted — the raw
 * token exists solely in memory between generation and delivery, never
 * logged or returned by any API response (STORY-002-007 mission, "Invitation
 * token").
 */
export class Invitation {
  readonly id: string;
  readonly organizationId: string;
  readonly email: Email;
  readonly role: OrganizationRole;
  readonly tokenHash: string;
  readonly status: InvitationStatus;
  readonly invitedBy: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly acceptedAt: Date | null;

  private constructor(props: InvitationProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.email = props.email;
    this.role = props.role;
    this.tokenHash = props.tokenHash;
    this.status = props.status;
    this.invitedBy = props.invitedBy;
    this.createdAt = props.createdAt;
    this.expiresAt = props.expiresAt;
    this.acceptedAt = props.acceptedAt;
  }

  static create(params: {
    id: string;
    organizationId: string;
    email: Email;
    role: OrganizationRole;
    tokenHash: string;
    invitedBy: string;
    createdAt?: Date;
  }): Invitation {
    const createdAt = params.createdAt ?? new Date();
    return new Invitation({
      id: params.id,
      organizationId: params.organizationId,
      email: params.email,
      role: params.role,
      tokenHash: params.tokenHash,
      status: "PENDING",
      invitedBy: params.invitedBy,
      createdAt,
      expiresAt: new Date(createdAt.getTime() + INVITATION_TTL_MS),
      acceptedAt: null,
    });
  }

  static fromPersistence(props: InvitationProps): Invitation {
    return new Invitation(props);
  }

  /** True when `status` is PENDING but `expiresAt` has already passed. */
  isExpired(now: Date = new Date()): boolean {
    return this.status === "PENDING" && this.expiresAt.getTime() <= now.getTime();
  }

  /** True when this invitation currently blocks a new one for the same (organization, email). */
  isActivePending(now: Date = new Date()): boolean {
    return this.status === "PENDING" && !this.isExpired(now);
  }
}
