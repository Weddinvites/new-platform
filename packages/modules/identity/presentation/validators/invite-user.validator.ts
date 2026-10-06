import { z } from "zod";
import { ORGANIZATION_ROLES } from "../../domain/value-objects/organization-role";

/**
 * Transport-level validation only (Architecture.md "Validation") for
 * POST /api/v1/management/users/invitations. Domain re-validates `email`
 * via the Email value object regardless of what called it.
 */
export const inviteUserRequestSchema = z.object({
  email: z.string().min(1, "email is required"),
  role: z.enum(ORGANIZATION_ROLES),
});

export type InviteUserRequestInput = z.infer<typeof inviteUserRequestSchema>;
