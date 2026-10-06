import { z } from "zod";

/**
 * Transport-level validation only (Architecture.md "Validation"): the path
 * parameter must be a syntactically valid UUID. Whether it identifies a real,
 * accessible Organization is a business/authorization concern resolved by
 * the use case (RetrieveOrganizationUseCase), not this schema.
 */
export const retrieveOrganizationParamsSchema = z.object({
  organizationId: z.string().uuid("organizationId must be a valid UUID"),
});

export type RetrieveOrganizationParamsInput = z.infer<typeof retrieveOrganizationParamsSchema>;
