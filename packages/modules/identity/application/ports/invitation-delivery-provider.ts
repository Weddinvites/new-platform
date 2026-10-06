import type { OrganizationRole } from "../../domain/value-objects/organization-role";

/**
 * STORY-002-007 — Invite User. Delivery of the invitation (e.g. by email) is
 * kept behind this port rather than coupling Identity to a concrete
 * messaging provider, since no messaging infrastructure exists in this
 * repository yet (mission Section 7). The raw, unhashed token is only ever
 * passed here, in memory, for a single call — implementations must never
 * log it.
 */
export interface InvitationDeliveryProvider {
  deliver(params: {
    email: string;
    organizationId: string;
    role: OrganizationRole;
    token: string;
    expiresAt: Date;
  }): Promise<void>;
}
