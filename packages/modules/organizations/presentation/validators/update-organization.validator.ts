import { z } from "zod";

/**
 * Transport-level validation only (Architecture.md "Validation"): the path
 * parameter must be a syntactically valid UUID. Whether it identifies a
 * real, accessible Organization is a business/authorization concern
 * resolved by the use case (UpdateOrganizationUseCase), not this schema.
 */
export const updateOrganizationParamsSchema = z.object({
  organizationId: z.string().uuid("organizationId must be a valid UUID"),
});

export type UpdateOrganizationParamsInput = z.infer<typeof updateOrganizationParamsSchema>;

/**
 * `display_name` is the only editable field (STORY-003-003 approved
 * contract). `.trim()` runs before `.min()`, so a missing, empty, or
 * whitespace-only value is rejected here, and the value the use case
 * receives is already trimmed — no separate trimming step is needed before
 * persistence. No other field (`slug`, `organization_type`, `id`,
 * `created_at`) is accepted by this schema.
 */
export const updateOrganizationRequestSchema = z.object({
  display_name: z.string().trim().min(1, "display_name is required"),
});

export type UpdateOrganizationRequestInput = z.infer<typeof updateOrganizationRequestSchema>;
