import { type Database, getDatabase, schema } from "@allinvites/database";
import { eq } from "drizzle-orm";
import { OrganizationMembership } from "../../domain/entities/organization-membership";
import { User } from "../../domain/entities/user";
import type { UserRepository } from "../../domain/repositories/user-repository";
import { Email } from "../../domain/value-objects/email";
import { FullName } from "../../domain/value-objects/full-name";
import type { MembershipStatus } from "../../domain/value-objects/membership-status";
import type { OrganizationRole } from "../../domain/value-objects/organization-role";

/**
 * Drizzle-backed implementation of UserRepository. Never exposes ORM rows
 * outside this file — every method returns Domain objects only
 * (DEVELOPMENT_RULES.md §9).
 */
export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: Database = getDatabase()) {}

  async findByEmail(email: Email): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email.value))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return User.fromPersistence({
      id: row.id,
      email: Email.create(row.email),
      fullName: FullName.create(row.fullName),
      emailVerified: row.emailVerified,
      createdAt: row.createdAt,
    });
  }

  async findById(id: string): Promise<User | null> {
    const rows = await this.db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return User.fromPersistence({
      id: row.id,
      email: Email.create(row.email),
      fullName: FullName.create(row.fullName),
      emailVerified: row.emailVerified,
      createdAt: row.createdAt,
    });
  }

  async findMembershipsByUserId(userId: string): Promise<OrganizationMembership[]> {
    const rows = await this.db
      .select()
      .from(schema.organizationMemberships)
      .where(eq(schema.organizationMemberships.userId, userId));

    return rows.map((row) =>
      OrganizationMembership.fromPersistence({
        id: row.id,
        userId: row.userId,
        organizationId: row.organizationId,
        role: row.role as OrganizationRole,
        status: row.status as MembershipStatus,
        createdAt: row.createdAt,
      }),
    );
  }

  async save(user: User, initialMembership: OrganizationMembership): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(schema.users).values({
        id: user.id,
        email: user.email.value,
        fullName: user.fullName.value,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      });

      await tx.insert(schema.organizationMemberships).values({
        id: initialMembership.id,
        userId: initialMembership.userId,
        organizationId: initialMembership.organizationId,
        role: initialMembership.role,
        createdAt: initialMembership.createdAt,
      });
    });
  }

  async updateFullName(userId: string, fullName: FullName): Promise<User> {
    const rows = await this.db
      .update(schema.users)
      .set({ fullName: fullName.value })
      .where(eq(schema.users.id, userId))
      .returning();

    const row = rows[0];
    if (!row) {
      throw new Error(`No User found for id ${userId} when updating full_name.`);
    }

    return User.fromPersistence({
      id: row.id,
      email: Email.create(row.email),
      fullName: FullName.create(row.fullName),
      emailVerified: row.emailVerified,
      createdAt: row.createdAt,
    });
  }
}
