/**
 * Public wire contract for Retrieve Subscription
 * (API_SPEC.md §30 "Billing API"; STORY-004-001). A standalone DTO — never
 * merged into `OrganizationDto` (STORY-003-002). `status` is the
 * Subscription's *effective* status, not necessarily its raw stored value
 * (see the Billing module's `Subscription.effectiveStatus`).
 */
export type OrganizationSubscriptionDto = {
  organization_id: string;
  plan: "EMPRENDEDOR" | "PLANNER_ESENCIAL" | "PLANNER_PROFESIONAL" | "AGENCIA_ILIMITADA";
  status: string;
  trial_ends_at: string | null;
  created_at: string;
};
