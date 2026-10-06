/**
 * Integration event produced by the Identity module (MASTER_SPEC §28.1
 * "Produce: UserInvited"). No event bus exists yet in this codebase; this
 * type exists so the InviteUser use case can return a well-typed event for
 * a future publisher to consume, without the Identity module inventing or
 * depending on messaging infrastructure it doesn't own.
 */
export type UserInvitedEvent = {
  readonly type: "UserInvited";
  readonly invitationId: string;
  readonly organizationId: string;
  readonly email: string;
  readonly role: string;
  readonly invitedBy: string;
  readonly occurredAt: Date;
};

export function userInvitedEvent(params: {
  invitationId: string;
  organizationId: string;
  email: string;
  role: string;
  invitedBy: string;
  occurredAt?: Date;
}): UserInvitedEvent {
  return {
    type: "UserInvited",
    invitationId: params.invitationId,
    organizationId: params.organizationId,
    email: params.email,
    role: params.role,
    invitedBy: params.invitedBy,
    occurredAt: params.occurredAt ?? new Date(),
  };
}
