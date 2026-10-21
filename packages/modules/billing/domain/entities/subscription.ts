export type SubscriptionPlan =
  | "EMPRENDEDOR"
  | "PLANNER_ESENCIAL"
  | "PLANNER_PROFESIONAL"
  | "AGENCIA_ILIMITADA";

export type SubscriptionStatus =
  | "TRIAL"
  | "ACTIVE"
  | "PAST_DUE"
  | "SUSPENDED"
  | "CANCELLED"
  | "EXPIRED";

export type SubscriptionProps = {
  id: string;
  organizationId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  createdAt: Date;
};

const TRIAL_LENGTH_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Subscription (MASTER_SPEC §26.13): one per Organization, owned exclusively
 * by the Billing module (ADR-011). STORY-004-001 only ever creates it in
 * `TRIAL`; every other status is out of this Story's scope.
 */
export class Subscription {
  readonly id: string;
  readonly organizationId: string;
  readonly plan: SubscriptionPlan;
  readonly status: SubscriptionStatus;
  readonly trialEndsAt: Date | null;
  readonly createdAt: Date;

  private constructor(props: SubscriptionProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.plan = props.plan;
    this.status = props.status;
    this.trialEndsAt = props.trialEndsAt;
    this.createdAt = props.createdAt;
  }

  /**
   * STORY-004-001 "Trial Enforcement" — a TRIAL Subscription past its
   * `trialEndsAt` is treated as PAST_DUE for every purpose (enforcement,
   * Retrieve) without a scheduled job ever writing that back to the stored
   * `status` column. Computed fresh on every call; never cached or mutated.
   */
  effectiveStatus(now: Date = new Date()): SubscriptionStatus {
    if (this.status === "TRIAL" && this.trialEndsAt !== null && now > this.trialEndsAt) {
      return "PAST_DUE";
    }
    return this.status;
  }

  isPastDue(now: Date = new Date()): boolean {
    return this.effectiveStatus(now) === "PAST_DUE";
  }

  static create(params: {
    id: string;
    organizationId: string;
    plan: SubscriptionPlan;
  }): Subscription {
    const createdAt = new Date();
    return new Subscription({
      id: params.id,
      organizationId: params.organizationId,
      plan: params.plan,
      status: "TRIAL",
      trialEndsAt: new Date(createdAt.getTime() + TRIAL_LENGTH_MS),
      createdAt,
    });
  }

  static fromPersistence(props: SubscriptionProps): Subscription {
    return new Subscription(props);
  }
}
