/**
 * Integration event produced by the Identity module (MASTER_SPEC §28.1
 * "Produce: UserAuthenticated"). No event bus exists yet in this codebase;
 * this type exists so the LoginUser use case can return a well-typed event
 * for a future publisher to consume, mirroring UserRegisteredEvent.
 */
export type UserAuthenticatedEvent = {
  readonly type: "UserAuthenticated";
  readonly userId: string;
  readonly occurredAt: Date;
};

export function userAuthenticatedEvent(params: {
  userId: string;
  occurredAt?: Date;
}): UserAuthenticatedEvent {
  return {
    type: "UserAuthenticated",
    userId: params.userId,
    occurredAt: params.occurredAt ?? new Date(),
  };
}
