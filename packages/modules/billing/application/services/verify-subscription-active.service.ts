import { err, ok, type Result } from "@allinvites/kernel";
import type { SubscriptionRepository } from "../../domain/repositories/subscription-repository";

export type VerifySubscriptionActiveError =
  | { readonly type: "SUBSCRIPTION_PAST_DUE" }
  | { readonly type: "UNEXPECTED"; readonly cause: unknown };

export type VerifySubscriptionActiveService = (params: {
  organizationId: string;
}) => Promise<Result<void, VerifySubscriptionActiveError>>;

/**
 * STORY-004-001 "Trial Enforcement" — the narrow, Billing-owned public
 * Application Service Organizations' Retrieve/Update use cases call (ADR-011:
 * Organizations never touches Subscription domain internals or the
 * `subscriptions` table directly). Computes the Subscription's *effective*
 * status at call time (see `Subscription.effectiveStatus`) — no scheduled
 * job, no stored-state mutation. A missing Subscription is treated as
 * UNEXPECTED: every Organization gets one atomically at creation, so its
 * absence means something else already went wrong.
 */
export function createVerifySubscriptionActiveService(
  subscriptionRepository: Pick<SubscriptionRepository, "findByOrganizationId">,
): VerifySubscriptionActiveService {
  return async ({ organizationId }) => {
    let subscription: Awaited<ReturnType<SubscriptionRepository["findByOrganizationId"]>>;
    try {
      subscription = await subscriptionRepository.findByOrganizationId(organizationId);
    } catch (error) {
      return err({ type: "UNEXPECTED", cause: error });
    }

    if (!subscription) {
      return err({
        type: "UNEXPECTED",
        cause: new Error(`Organization ${organizationId} has no Subscription.`),
      });
    }

    if (subscription.isPastDue()) {
      return err({ type: "SUBSCRIPTION_PAST_DUE" });
    }

    return ok(undefined);
  };
}
