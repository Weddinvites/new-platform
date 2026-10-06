import { getEnv } from "@allinvites/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

/**
 * The transaction-scoped handle passed to a `Database.transaction(...)`
 * callback. Exposed so a cross-module Application Service (e.g.
 * `createInitialOwnerMembershipService`, EPIC-003) can participate in a
 * transaction opened by another module's use case, without either module
 * inventing a second transaction mechanism (ADR-011).
 */
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

let cachedDb: Database | undefined;

/**
 * Returns a process-wide singleton Drizzle client. Never instantiated
 * directly inside business code (DEVELOPMENT_RULES.md §8, Dependency
 * Injection) — infrastructure repositories receive it via constructor.
 */
export function getDatabase(): Database {
  if (!cachedDb) {
    const env = getEnv();
    const client = postgres(env.DATABASE_URL, { prepare: false });
    cachedDb = drizzle(client, { schema });
  }

  return cachedDb;
}
