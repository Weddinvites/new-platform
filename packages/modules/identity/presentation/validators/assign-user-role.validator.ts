import { z } from "zod";
import { ORGANIZATION_ROLES } from "../../domain/value-objects/organization-role";

/** Transport-level validation for POST /api/v1/management/users/{userId}/role. */
export const assignUserRoleRequestSchema = z.object({
  role: z.enum(ORGANIZATION_ROLES),
});

export type AssignUserRoleRequestInput = z.infer<typeof assignUserRoleRequestSchema>;
