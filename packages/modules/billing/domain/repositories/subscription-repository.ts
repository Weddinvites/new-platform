import type { Transaction } from "@allinvites/database";
import type { Subscription } from "../entities/subscription";

/**
 * Repository interface (domain-owned port) for the Subscription aggregate.
 * Implemented by DrizzleSubscriptionRepository in the Infrastructure layer.
 */
export interface SubscriptionRepository {
  /**
   * STORY-004-001 — inserts within the transaction opened by Organizations'
   * CreateOrganizationUseCase, so it commits atomically together with the
   * Organization and its OWNER membership.
   */
  create(subscription: Subscription, tx: Transaction): Promise<void>;

  findByOrganizationId(organizationId: string): Promise<Subscription | null>;
}
