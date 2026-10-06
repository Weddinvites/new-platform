import { type Database, getDatabase, schema } from "@allinvites/database";
import { eq } from "drizzle-orm";
import type { OrganizationLookupPort } from "../../application/ports/organization-lookup.port";

export class DrizzleOrganizationLookup implements OrganizationLookupPort {
  constructor(private readonly db: Database = getDatabase()) {}

  async findIdBySlug(slug: string): Promise<string | null> {
    const rows = await this.db
      .select({ id: schema.organizations.id })
      .from(schema.organizations)
      .where(eq(schema.organizations.slug, slug))
      .limit(1);

    return rows[0]?.id ?? null;
  }
}
