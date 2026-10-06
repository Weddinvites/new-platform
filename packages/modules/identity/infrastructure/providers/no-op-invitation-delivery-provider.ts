import type { InvitationDeliveryProvider } from "../../application/ports/invitation-delivery-provider";

/**
 * STORY-002-007 — no concrete invitation-delivery mechanism (email or
 * otherwise) exists in this repository yet (mission Section 7: "do not
 * invent an external email provider if no existing messaging infrastructure
 * exists"). This adapter intentionally does nothing — it never logs the raw
 * token it receives. The persisted Invitation row (with only its token hash)
 * is the authoritative pending invitation; there is currently no way to
 * deliver the raw token to the invited person. This is a documented known
 * gap, not a stub standing in for missing logic.
 */
export class NoOpInvitationDeliveryProvider implements InvitationDeliveryProvider {
  async deliver(): Promise<void> {
    // Intentionally does nothing. Never log `params.token`.
  }
}
