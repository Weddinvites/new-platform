/**
 * Invitation lifecycle status (STORY-002-007 — Invite User). PENDING is the
 * only status this Story ever transitions *into* via an application flow;
 * ACCEPTED/EXPIRED/REVOKED are modeled now because they are part of the
 * approved persistence shape, even though nothing in this Story transitions
 * an invitation into them yet (consumption belongs to a future, explicitly
 * approved change to STORY-002-001).
 */
export const INVITATION_STATUSES = ["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"] as const;

export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export function isInvitationStatus(value: string): value is InvitationStatus {
  return (INVITATION_STATUSES as readonly string[]).includes(value);
}
