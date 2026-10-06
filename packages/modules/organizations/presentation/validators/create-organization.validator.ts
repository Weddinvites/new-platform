import { z } from "zod";

/**
 * Transport-level validation only (Architecture.md "Validation"): rejects a
 * missing, empty, or whitespace-only display_name and a non-string slug early.
 * display_name is trimmed here because nothing downstream normalizes it (no
 * DisplayName value object exists), matching STORY-003-003's update validator.
 * Normalization (lowercase-kebab-case) and the "resulting slug must not be
 * empty" invariant remain the domain Slug value object's responsibility — the
 * authoritative source, always re-checked by the use case regardless of what
 * called it.
 */
export const createOrganizationRequestSchema = z.object({
  display_name: z.string().trim().min(1, "display_name is required"),
  slug: z.string().min(1).optional(),
});

export type CreateOrganizationRequestInput = z.infer<typeof createOrganizationRequestSchema>;
