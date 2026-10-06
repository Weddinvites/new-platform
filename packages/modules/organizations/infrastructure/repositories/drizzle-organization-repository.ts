import { type Database, getDatabase, schema, type Transaction } from "@allinvites/database";
import { asc, count, eq, inArray } from "drizzle-orm";
import { Organization } from "../../domain/entities/organization";
import type { OrganizationRepository } from "../../domain/repositories/organization-repository";
import type { OrganizationType } from "../../domain/value-objects/organization-type";
import { Slug } from "../../domain/value-objects/slug";

/**
 * Drizzle-backed implementation of OrganizationRepository. Never exposes ORM
 * rows outside this file — every method returns Domain objects only
 * (DEVELOPMENT_RULES.md §9).
 */
export class DrizzleOrganizationRepository implements OrganizationRepository {
  constructor(private readonly db: Database = getDatabase()) {}

  async create(organization: Organization, tx: Transaction): Promise<void> {
    await tx.insert(schema.organizations).values({
      id: organization.id,
      organizationType: organization.organizationType,
      slug: organization.slug.value,
      displayName: organization.displayName,
      createdAt: organization.createdAt,
    });
  }

  async findById(id: string): Promise<Organization | null> {
    const rows = await this.db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, id))
      .limit(1);

    const row = rows[0];
    return row ? this.toOrganization(row) : null;
  }

  async findByIds(
    ids: string[],
    pagination: { page: number; pageSize: number },
  ): Promise<{ items: Organization[]; total: number }> {
    const offset = (pagination.page - 1) * pagination.pageSize;

    const [rows, totalRows] = await Promise.all([
      this.db
        .select()
        .from(schema.organizations)
        .where(inArray(schema.organizations.id, ids))
        .orderBy(asc(schema.organizations.createdAt))
        .limit(pagination.pageSize)
        .offset(offset),
      this.db
        .select({ value: count() })
        .from(schema.organizations)
        .where(inArray(schema.organizations.id, ids)),
    ]);

    return {
      items: rows.map((row) => this.toOrganization(row)),
      total: totalRows[0]?.value ?? 0,
    };
  }

  async update(id: string, changes: { displayName: string }): Promise<Organization> {
    const rows = await this.db
      .update(schema.organizations)
      .set({ displayName: changes.displayName })
      .where(eq(schema.organizations.id, id))
      .returning();

    const row = rows[0];
    if (!row) {
      throw new Error(`Organization ${id} not found during update.`);
    }
    return this.toOrganization(row);
  }

  async updateBranding(
    id: string,
    changes: Partial<{
      brandName: string;
      logo: string;
      primaryColor: string;
      secondaryColor: string;
    }>,
  ): Promise<Organization> {
    const rows = await this.db
      .update(schema.organizations)
      .set(changes)
      .where(eq(schema.organizations.id, id))
      .returning();

    const row = rows[0];
    if (!row) {
      throw new Error(`Organization ${id} not found during branding update.`);
    }
    return this.toOrganization(row);
  }

  async updateSettings(
    id: string,
    changes: { supportContactEmail: string },
  ): Promise<Organization> {
    const rows = await this.db
      .update(schema.organizations)
      .set({ supportContactEmail: changes.supportContactEmail })
      .where(eq(schema.organizations.id, id))
      .returning();

    const row = rows[0];
    if (!row) {
      throw new Error(`Organization ${id} not found during settings update.`);
    }
    return this.toOrganization(row);
  }

  private toOrganization(row: typeof schema.organizations.$inferSelect): Organization {
    return Organization.fromPersistence({
      id: row.id,
      organizationType: row.organizationType as OrganizationType,
      slug: Slug.fromPersistence(row.slug),
      displayName: row.displayName,
      createdAt: row.createdAt,
      brandName: row.brandName,
      logo: row.logo,
      primaryColor: row.primaryColor,
      secondaryColor: row.secondaryColor,
      supportContactEmail: row.supportContactEmail,
    });
  }
}
