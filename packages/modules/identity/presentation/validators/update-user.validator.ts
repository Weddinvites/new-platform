import { z } from "zod";

/**
 * Transport-level validation only (Architecture.md "Validation") for
 * PATCH /api/v1/management/users/{userId}. Domain re-validates `full_name`
 * via the FullName value object regardless of what called it.
 */
export const updateUserRequestSchema = z.object({
  full_name: z.string().min(1, "full_name is required"),
});

export type UpdateUserRequestInput = z.infer<typeof updateUserRequestSchema>;
