import type { Invitation } from "../entities/invitation";
import type { Email } from "../value-objects/email";

/**
 * Repository interface (domain-owned port) for the STORY-002-007 Invitation
 * aggregate. Deliberately minimal — only what Invite User (this Story)
 * needs. Consumption (lookup by token, marking ACCEPTED) is intentionally
 * out of scope: it belongs to the future, explicitly approved change that
 * wires invitation acceptance into `POST /auth/register`.
 */
export interface InvitationRepository {
  /**
   * The active PENDING (non-expired) invitation for this
   * (organizationId, email) pair, if any — used to enforce
   * INVITATION_ALREADY_PENDING (USER_FLOWS.md Flow 15 "Duplicate Invitation").
   */
  findActivePendingByOrganizationAndEmail(
    organizationId: string,
    email: Email,
  ): Promise<Invitation | null>;

  save(invitation: Invitation): Promise<void>;
}
