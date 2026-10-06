import { DomainError } from "@allinvites/kernel";

/**
 * Matches API_SPEC.md §21a "Registration" — INVALID_OR_EXPIRED_TOKEN.
 *
 * No invitation system exists yet (STORY-002-007 — Internal User / Team
 * Management, which owns "Invite User", is not implemented). Until it is,
 * every supplied invitation_token is necessarily invalid, since none could
 * ever have been legitimately issued — this is not a stub shortcut, it is
 * the correct behavior for the system's current, real state.
 */
export class InvalidInvitationTokenError extends DomainError {
  readonly code = "INVALID_OR_EXPIRED_TOKEN";

  constructor() {
    super("The invitation token is invalid or has expired.");
  }
}
