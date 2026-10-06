/**
 * Integration event produced by the Identity module (MASTER_SPEC §28.1
 * "Produce: UserRemoved"). No event bus exists yet in this codebase; this
 * type exists so the RemoveUser use case can return a well-typed event for
 * a future publisher to consume, without the Identity module inventing or
 * depending on messaging infrastructure it doesn't own.
 */
export type UserRemovedEvent = {
  readonly type: "UserRemoved";
  readonly userId: string;
  readonly organizationId: string;
  readonly removedBy: string;
  readonly occurredAt: Date;
};

export function userRemovedEvent(params: {
  userId: string;
  organizationId: string;
  removedBy: string;
  occurredAt?: Date;
}): UserRemovedEvent {
  return {
    type: "UserRemoved",
    userId: params.userId,
    organizationId: params.organizationId,
    removedBy: params.removedBy,
    occurredAt: params.occurredAt ?? new Date(),
  };
}
