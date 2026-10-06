import { DomainError } from "@allinvites/kernel";

/**
 * STORY-002-007 — Invite User. Matches USER_FLOWS.md Flow 15 "Duplicate
 * Invitation" alt-flow: an active, non-expired PENDING invitation already
 * exists for this (organization, email) pair.
 */
export class InvitationAlreadyPendingError extends DomainError {
  readonly code = "INVITATION_ALREADY_PENDING";

  constructor() {
    super("An invitation is already pending for this email address in this organization.");
  }
}
