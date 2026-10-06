import { z } from "zod";

/**
 * STORY-002-007 interim organization-context input (mission Section 5):
 * `organization_id` as a required query parameter. Required as a query
 * parameter (not a body field) because the approved request bodies for
 * Invite User / Update User / Assign Role are closed schemas that do not
 * include it — this is the only location consistent with every operation,
 * including the bodyless GET/DELETE/POST-action ones.
 */
export const organizationContextQuerySchema = z.object({
  organization_id: z.string().min(1, "organization_id is required"),
});

/** List Users additionally accepts standard pagination query parameters (API_SPEC.md §16). */
export const listUsersQuerySchema = organizationContextQuerySchema.extend({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
});
