import { err, ok, type Result } from "@allinvites/kernel";
import type { SubscriptionPlan, SubscriptionStatus } from "../../domain/entities/subscription";
import type { SubscriptionRepository } from "../../domain/repositories/subscription-repository";

export type SubscriptionSummary = {
  readonly id: string;
  readonly organizationId: string;
  readonly plan: SubscriptionPlan;
  /** The *effective* status (STORY-004-001 "Trial Enforcement"), not necessarily the raw stored value. */
  readonly status: SubscriptionStatus;
  readonly trialEndsAt: Date | null;
  readonly createdAt: Date;
};

export type RetrieveSubscriptionSummaryError =
  | { readonly type: "NOT_FOUND" }
  | { readonly type: "UNEXPECTED"; readonly cause: unknown };

export type RetrieveSubscriptionSummaryService = (params: {
  organizationId: string;
}) => Promise<Result<SubscriptionSummary, RetrieveSubscriptionSummaryError>>;

/**
 * STORY-004-001 — the Billing-owned read Organizations' Retrieve Subscription
 * use case calls, after it has already resolved membership/concealment
 * itself (ADR-011: Organizations never touches Subscription domain
 * internals or the `subscriptions` table directly). `NOT_FOUND` should never
 * actually occur given every Organization gets one Subscription atomically
 * at creation — handled defensively only.
 */
export function createRetrieveSubscriptionSummaryService(
  subscriptionRepository: Pick<SubscriptionRepository, "findByOrganizationId">,
): RetrieveSubscriptionSummaryService {
  return async ({ organizationId }) => {
    let subscription: Awaited<ReturnType<SubscriptionRepository["findByOrganizationId"]>>;
    try {
      subscription = await subscriptionRepository.findByOrganizationId(organizationId);
    } catch (error) {
      return err({ type: "UNEXPECTED", cause: error });
    }

    if (!subscription) {
      return err({ type: "NOT_FOUND" });
    }

    return ok({
      id: subscription.id,
      organizationId: subscription.organizationId,
      plan: subscription.plan,
      status: subscription.effectiveStatus(),
      trialEndsAt: subscription.trialEndsAt,
      createdAt: subscription.createdAt,
    });
  };
}
