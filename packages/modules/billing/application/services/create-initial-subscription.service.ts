import type { Transaction } from "@allinvites/database";
import { err, ok, type Result } from "@allinvites/kernel";
import type { RecordAuditEventService } from "@allinvites/module-audit";
import {
  Subscription,
  type SubscriptionPlan,
  type SubscriptionStatus,
} from "../../domain/entities/subscription";
import type { SubscriptionRepository } from "../../domain/repositories/subscription-repository";

export type CreateInitialSubscriptionError = {
  readonly type: "UNEXPECTED";
  readonly cause: unknown;
};

export type CreateInitialSubscriptionResult = {
  readonly subscriptionId: string;
  readonly plan: SubscriptionPlan;
  readonly status: SubscriptionStatus;
  readonly trialEndsAt: Date | null;
  readonly createdAt: Date;
};

export type CreateInitialSubscriptionService = (
  params: { organizationId: string; plan: SubscriptionPlan; userId: string },
  tx: Transaction,
) => Promise<Result<CreateInitialSubscriptionResult, CreateInitialSubscriptionError>>;

/**
 * STORY-004-001 — the one new Billing-owned public Application Service
 * Organizations' Create Organization use case calls, inside the same
 * transaction already used for Identity's CreateInitialOwnerMembershipService
 * (ADR-011: Organizations never touches Subscription domain internals or the
 * `subscriptions` table directly). Always creates a `TRIAL` Subscription —
 * no payment check, matching the decided MVP behavior. Returns only
 * primitives, never the Subscription entity itself.
 */
export function createCreateInitialSubscriptionService(
  subscriptionRepository: Pick<SubscriptionRepository, "create">,
  recordAuditEvent: RecordAuditEventService,
): CreateInitialSubscriptionService {
  return async (params, tx) => {
    const subscription = Subscription.create({
      id: crypto.randomUUID(),
      organizationId: params.organizationId,
      plan: params.plan,
    });

    try {
      await subscriptionRepository.create(subscription, tx);
    } catch (error) {
      return err({ type: "UNEXPECTED", cause: error });
    }

    const audit = await recordAuditEvent(
      {
        userId: params.userId,
        organizationId: params.organizationId,
        action: "SUBSCRIPTION_CREATED",
        resourceType: "Subscription",
        resourceId: subscription.id,
        result: "SUCCESS",
        metadata: { plan: subscription.plan, status: subscription.status },
      },
      tx,
    );

    if (!audit.ok) {
      throw new Error("Audit record could not be written.", { cause: audit.error.cause });
    }

    return ok({
      subscriptionId: subscription.id,
      plan: subscription.plan,
      status: subscription.status,
      trialEndsAt: subscription.trialEndsAt,
      createdAt: subscription.createdAt,
    });
  };
}
