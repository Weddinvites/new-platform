import { z } from "zod";

/**
 * Standard pagination query parameters (API_SPEC.md §16 — default page=1,
 * pageSize=25, max pageSize=100). No `organization_id`, filter, or sort
 * parameters — List Organizations enumerates Organizations themselves and
 * supports no client-configurable filtering or sorting (STORY-003-002
 * approved contract).
 */
export const listOrganizationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
});

export type ListOrganizationsQueryInput = z.infer<typeof listOrganizationsQuerySchema>;
