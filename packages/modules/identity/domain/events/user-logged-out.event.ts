/**
 * Integration event produced by the Identity module (MASTER_SPEC §28.1
 * "Produce: UserLoggedOut"). No event bus exists yet in this codebase; this
 * type exists so the Logout use case can return a well-typed event for a
 * future publisher to consume, mirroring UserRegisteredEvent and
 * UserAuthenticatedEvent.
 */
export type UserLoggedOutEvent = {
  readonly type: "UserLoggedOut";
  readonly userId: string;
  readonly occurredAt: Date;
};

export function userLoggedOutEvent(params: {
  userId: string;
  occurredAt?: Date;
}): UserLoggedOutEvent {
  return {
    type: "UserLoggedOut",
    userId: params.userId,
    occurredAt: params.occurredAt ?? new Date(),
  };
}
