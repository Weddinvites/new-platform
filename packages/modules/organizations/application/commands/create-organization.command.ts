import type { SubscriptionPlan } from "@allinvites/module-billing";

export type CreateOrganizationCommand = {
  displayName: string;
  slug?: string;
  plan: SubscriptionPlan;
};
