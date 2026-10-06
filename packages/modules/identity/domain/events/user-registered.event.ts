/**
 * Integration event produced by the Identity module (MASTER_SPEC §28.1
 * "Produce: UserRegistered"). No event bus exists yet in this codebase;
 * this type exists so the RegisterUser use case can return a well-typed
 * event for a future publisher to consume, without the Identity module
 * inventing or depending on messaging infrastructure it doesn't own.
 */
export type UserRegisteredEvent = {
  readonly type: "UserRegistered";
  readonly userId: string;
  readonly organizationId: string;
  readonly role: string;
  readonly occurredAt: Date;
};

export function userRegisteredEvent(params: {
  userId: string;
  organizationId: string;
  role: string;
  occurredAt?: Date;
}): UserRegisteredEvent {
  return {
    type: "UserRegistered",
    userId: params.userId,
    organizationId: params.organizationId,
    role: params.role,
    occurredAt: params.occurredAt ?? new Date(),
  };
}
