import { type Database, getDatabase, schema, type Transaction } from "@allinvites/database";
import { and, count, eq } from "drizzle-orm";
import { OrganizationMembership } from "../../domain/entities/organization-membership";
import { User } from "../../domain/entities/user";
import type {
  ListOrganizationMembersResult,
  MembershipWithUser,
  OrganizationMembershipRepository,
} from "../../domain/repositories/organization-membership-repository";
import { Email } from "../../domain/value-objects/email";
import { FullName } from "../../domain/value-objects/full-name";
import type { MembershipStatus } from "../../domain/value-objects/membership-status";
import type { OrganizationRole } from "../../domain/value-objects/organization-role";

/**
 * Drizzle-backed implementation of OrganizationMembershipRepository
 * (STORY-002-007). Never exposes ORM rows outside this file — every method
 * returns Domain objects only (DEVELOPMENT_RULES.md §9).
 */
export class DrizzleOrganizationMembershipRepository implements OrganizationMembershipRepository {
  constructor(private readonly db: Database = getDatabase()) {}

  private toMembership(
    row: typeof schema.organizationMemberships.$inferSelect,
  ): OrganizationMembership {
    return OrganizationMembership.fromPersistence({
      id: row.id,
      userId: row.userId,
      organizationId: row.organizationId,
      role: row.role as OrganizationRole,
      status: row.status as MembershipStatus,
      createdAt: row.createdAt,
    });
  }

  private toUser(row: typeof schema.users.$inferSelect): User {
    return User.fromPersistence({
      id: row.id,
      email: Email.create(row.email),
      fullName: FullName.create(row.fullName),
      emailVerified: row.emailVerified,
      createdAt: row.createdAt,
    });
  }

  async create(membership: OrganizationMembership, tx: Transaction): Promise<void> {
    await tx.insert(schema.organizationMemberships).values({
      id: membership.id,
      userId: membership.userId,
      organizationId: membership.organizationId,
      role: membership.role,
      status: membership.status,
      createdAt: membership.createdAt,
    });
  }

  async findByUserAndOrganization(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationMembership | null> {
    const rows = await this.db
      .select()
      .from(schema.organizationMemberships)
      .where(
        and(
          eq(schema.organizationMemberships.userId, userId),
          eq(schema.organizationMemberships.organizationId, organizationId),
        ),
      )
      .limit(1);

    const row = rows[0];
    return row ? this.toMembership(row) : null;
  }

  async findMemberWithUser(
    userId: string,
    organizationId: string,
  ): Promise<MembershipWithUser | null> {
    const rows = await this.db
      .select({ membership: schema.organizationMemberships, user: schema.users })
      .from(schema.organizationMemberships)
      .innerJoin(schema.users, eq(schema.organizationMemberships.userId, schema.users.id))
      .where(
        and(
          eq(schema.organizationMemberships.userId, userId),
          eq(schema.organizationMemberships.organizationId, organizationId),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return { membership: this.toMembership(row.membership), user: this.toUser(row.user) };
  }

  async listByOrganization(
    organizationId: string,
    pagination: { page: number; pageSize: number },
  ): Promise<ListOrganizationMembersResult> {
    const offset = (pagination.page - 1) * pagination.pageSize;

    const [rows, totalRows] = await Promise.all([
      this.db
        .select({ membership: schema.organizationMemberships, user: schema.users })
        .from(schema.organizationMemberships)
        .innerJoin(schema.users, eq(schema.organizationMemberships.userId, schema.users.id))
        .where(eq(schema.organizationMemberships.organizationId, organizationId))
        .limit(pagination.pageSize)
        .offset(offset),
      this.db
        .select({ value: count() })
        .from(schema.organizationMemberships)
        .where(eq(schema.organizationMemberships.organizationId, organizationId)),
    ]);

    const items: MembershipWithUser[] = rows.map((row) => ({
      membership: this.toMembership(row.membership),
      user: this.toUser(row.user),
    }));

    return { items, total: totalRows[0]?.value ?? 0 };
  }

  async countActiveOwners(organizationId: string): Promise<number> {
    const rows = await this.db
      .select({ value: count() })
      .from(schema.organizationMemberships)
      .where(
        and(
          eq(schema.organizationMemberships.organizationId, organizationId),
          eq(schema.organizationMemberships.role, "OWNER"),
          eq(schema.organizationMemberships.status, "ACTIVE"),
        ),
      );

    return rows[0]?.value ?? 0;
  }

  async updateStatus(
    membershipId: string,
    status: MembershipStatus,
  ): Promise<OrganizationMembership> {
    const rows = await this.db
      .update(schema.organizationMemberships)
      .set({ status })
      .where(eq(schema.organizationMemberships.id, membershipId))
      .returning();

    const row = rows[0];
    if (!row) {
      throw new Error(
        `No OrganizationMembership found for id ${membershipId} when updating status.`,
      );
    }

    return this.toMembership(row);
  }

  async updateRole(membershipId: string, role: OrganizationRole): Promise<OrganizationMembership> {
    const rows = await this.db
      .update(schema.organizationMemberships)
      .set({ role })
      .where(eq(schema.organizationMemberships.id, membershipId))
      .returning();

    const row = rows[0];
    if (!row) {
      throw new Error(`No OrganizationMembership found for id ${membershipId} when updating role.`);
    }

    return this.toMembership(row);
  }
}
