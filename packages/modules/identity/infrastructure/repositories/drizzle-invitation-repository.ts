import { type Database, getDatabase, schema } from "@allinvites/database";
import { and, eq } from "drizzle-orm";
import { Invitation } from "../../domain/entities/invitation";
import type { InvitationRepository } from "../../domain/repositories/invitation-repository";
import { Email } from "../../domain/value-objects/email";
import type { InvitationStatus } from "../../domain/value-objects/invitation-status";
import type { OrganizationRole } from "../../domain/value-objects/organization-role";

/**
 * Drizzle-backed implementation of InvitationRepository (STORY-002-007).
 * Never exposes ORM rows outside this file — every method returns Domain
 * objects only (DEVELOPMENT_RULES.md §9). Only the token hash is ever read
 * or written here; the raw token never reaches persistence.
 */
export class DrizzleInvitationRepository implements InvitationRepository {
  constructor(private readonly db: Database = getDatabase()) {}

  async findActivePendingByOrganizationAndEmail(
    organizationId: string,
    email: Email,
  ): Promise<Invitation | null> {
    const rows = await this.db
      .select()
      .from(schema.userInvitations)
      .where(
        and(
          eq(schema.userInvitations.organizationId, organizationId),
          eq(schema.userInvitations.email, email.value),
          eq(schema.userInvitations.status, "PENDING"),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return Invitation.fromPersistence({
      id: row.id,
      organizationId: row.organizationId,
      email: Email.create(row.email),
      role: row.role as OrganizationRole,
      tokenHash: row.tokenHash,
      status: row.status as InvitationStatus,
      invitedBy: row.invitedBy,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      acceptedAt: row.acceptedAt,
    });
  }

  async save(invitation: Invitation): Promise<void> {
    await this.db.insert(schema.userInvitations).values({
      id: invitation.id,
      organizationId: invitation.organizationId,
      email: invitation.email.value,
      role: invitation.role,
      tokenHash: invitation.tokenHash,
      status: invitation.status,
      invitedBy: invitation.invitedBy,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt,
    });
  }
}
