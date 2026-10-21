/**
 * Public wire contract for POST /api/v1/management/organizations, matching
 * API_SPEC.md §22 "Create Organization" exactly (snake_case field names,
 * matching the documented JSON schema).
 */
export type CreateOrganizationRequestDto = {
  display_name: string;
  slug?: string;
  plan_id: "EMPRENDEDOR" | "PLANNER_ESENCIAL" | "PLANNER_PROFESIONAL" | "AGENCIA_ILIMITADA";
};

export type CreatedOrganizationDto = {
  id: string;
  organization_type: "PARTNER";
  slug: string;
  display_name: string;
  created_at: string;
  membership: {
    id: string;
    organization_id: string;
    role: "OWNER";
    status: "ACTIVE";
  };
  /** STORY-004-001 — the Organization's initial Subscription, created atomically alongside it. */
  subscription: {
    id: string;
    organization_id: string;
    plan: "EMPRENDEDOR" | "PLANNER_ESENCIAL" | "PLANNER_PROFESIONAL" | "AGENCIA_ILIMITADA";
    status: string;
    trial_ends_at: string | null;
    created_at: string;
  };
};
