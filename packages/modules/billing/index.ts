// Public surface of the billing module. Internal folders (domain,
// infrastructure) remain private — see Architecture.md "Module Communication".

import { recordAuditEvent } from "@allinvites/module-audit";
import {
  type CreateInitialSubscriptionService,
  createCreateInitialSubscriptionService,
} from "./application/services/create-initial-subscription.service";
import {
  createRetrieveSubscriptionSummaryService,
  type RetrieveSubscriptionSummaryService,
} from "./application/services/retrieve-subscription-summary.service";
import {
  createVerifySubscriptionActiveService,
  type VerifySubscriptionActiveService,
} from "./application/services/verify-subscription-active.service";
import type { SubscriptionPlan } from "./domain/entities/subscription";
import { DrizzleSubscriptionRepository } from "./infrastructure/repositories/drizzle-subscription-repository";

export {
  type CreateInitialSubscriptionError,
  type CreateInitialSubscriptionResult,
  type CreateInitialSubscriptionService,
  createCreateInitialSubscriptionService,
} from "./application/services/create-initial-subscription.service";
export {
  createRetrieveSubscriptionSummaryService,
  type RetrieveSubscriptionSummaryError,
  type RetrieveSubscriptionSummaryService,
  type SubscriptionSummary,
} from "./application/services/retrieve-subscription-summary.service";
export {
  createVerifySubscriptionActiveService,
  type VerifySubscriptionActiveError,
  type VerifySubscriptionActiveService,
} from "./application/services/verify-subscription-active.service";
export type { SubscriptionPlan, SubscriptionStatus } from "./domain/entities/subscription";

let cachedRepository: DrizzleSubscriptionRepository | undefined;

/** Instantiated lazily, on first call, never at import time (reads env vars via getDatabase()). */
function getRepository(): DrizzleSubscriptionRepository {
  if (!cachedRepository) {
    cachedRepository = new DrizzleSubscriptionRepository();
  }
  return cachedRepository;
}

let cachedCreateInitialSubscription: CreateInitialSubscriptionService | undefined;

/**
 * Ready-to-use, pre-wired `CreateInitialSubscriptionService` (STORY-004-001).
 * Always creates a `TRIAL` Subscription inside the caller's transaction.
 * Instantiates infrastructure lazily, on first call, never at import time.
 */
export function createInitialSubscription(
  params: { organizationId: string; plan: SubscriptionPlan; userId: string },
  tx: Parameters<CreateInitialSubscriptionService>[1],
): ReturnType<CreateInitialSubscriptionService> {
  if (!cachedCreateInitialSubscription) {
    cachedCreateInitialSubscription = createCreateInitialSubscriptionService(
      getRepository(),
      recordAuditEvent,
    );
  }
  return cachedCreateInitialSubscription(params, tx);
}

let cachedVerifySubscriptionActive: VerifySubscriptionActiveService | undefined;

/**
 * Ready-to-use, pre-wired `VerifySubscriptionActiveService` (STORY-004-001
 * "Trial Enforcement"). Computes the Subscription's effective status at call
 * time — no scheduled job, no stored-state mutation.
 */
export function verifySubscriptionActive(
  params: Parameters<VerifySubscriptionActiveService>[0],
): ReturnType<VerifySubscriptionActiveService> {
  if (!cachedVerifySubscriptionActive) {
    cachedVerifySubscriptionActive = createVerifySubscriptionActiveService(getRepository());
  }
  return cachedVerifySubscriptionActive(params);
}

let cachedRetrieveSubscriptionSummary: RetrieveSubscriptionSummaryService | undefined;

/**
 * Ready-to-use, pre-wired `RetrieveSubscriptionSummaryService`
 * (STORY-004-001). Returns the effective status, not necessarily the raw
 * stored value — see `Subscription.effectiveStatus`.
 */
export function retrieveSubscriptionSummary(
  params: Parameters<RetrieveSubscriptionSummaryService>[0],
): ReturnType<RetrieveSubscriptionSummaryService> {
  if (!cachedRetrieveSubscriptionSummary) {
    cachedRetrieveSubscriptionSummary = createRetrieveSubscriptionSummaryService(getRepository());
  }
  return cachedRetrieveSubscriptionSummary(params);
}
