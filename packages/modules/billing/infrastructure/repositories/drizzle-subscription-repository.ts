import { type Database, getDatabase, schema, type Transaction } from "@allinvites/database";
import { eq } from "drizzle-orm";
import {
  Subscription,
  type SubscriptionPlan,
  type SubscriptionStatus,
} from "../../domain/entities/subscription";
import type { SubscriptionRepository } from "../../domain/repositories/subscription-repository";

/**
 * Drizzle-backed implementation of SubscriptionRepository. Never exposes ORM
 * rows outside this file — every method returns Domain objects only
 * (DEVELOPMENT_RULES.md §9).
 */
export class DrizzleSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly db: Database = getDatabase()) {}

  async create(subscription: Subscription, tx: Transaction): Promise<void> {
    await tx.insert(schema.subscriptions).values({
      id: subscription.id,
      organizationId: subscription.organizationId,
      plan: subscription.plan,
      status: subscription.status,
      trialEndsAt: subscription.trialEndsAt,
      createdAt: subscription.createdAt,
    });
  }

  async findByOrganizationId(organizationId: string): Promise<Subscription | null> {
    const rows = await this.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.organizationId, organizationId))
      .limit(1);

    const row = rows[0];
    return row ? this.toSubscription(row) : null;
  }

  private toSubscription(row: typeof schema.subscriptions.$inferSelect): Subscription {
    return Subscription.fromPersistence({
      id: row.id,
      organizationId: row.organizationId,
      plan: row.plan as SubscriptionPlan,
      status: row.status as SubscriptionStatus,
      trialEndsAt: row.trialEndsAt,
      createdAt: row.createdAt,
    });
  }
}
