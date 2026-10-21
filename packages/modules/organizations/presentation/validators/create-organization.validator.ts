import { z } from "zod";

const SUBSCRIPTION_PLANS = [
  "EMPRENDEDOR",
  "PLANNER_ESENCIAL",
  "PLANNER_PROFESIONAL",
  "AGENCIA_ILIMITADA",
] as const;

/**
 * Transport-level validation only (Architecture.md "Validation"): rejects a
 * missing, empty, or whitespace-only display_name, a non-string slug, and a
 * missing/unrecognized plan_id early.
 * display_name is trimmed here because nothing downstream normalizes it (no
 * DisplayName value object exists), matching STORY-003-003's update validator.
 * Normalization (lowercase-kebab-case) and the "resulting slug must not be
 * empty" invariant remain the domain Slug value object's responsibility — the
 * authoritative source, always re-checked by the use case regardless of what
 * called it.
 *
 * STORY-004-001 — plan_id is required: the plan is chosen by the purchaser
 * at signup, there is no default. One of the four MASTER_SPEC §16.3 plans.
 */
export const createOrganizationRequestSchema = z.object({
  display_name: z.string().trim().min(1, "display_name is required"),
  slug: z.string().min(1).optional(),
  plan_id: z.enum(SUBSCRIPTION_PLANS),
});

export type CreateOrganizationRequestInput = z.infer<typeof createOrganizationRequestSchema>;
