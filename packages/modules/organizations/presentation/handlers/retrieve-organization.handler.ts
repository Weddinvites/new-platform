import type { RetrieveOrganizationUseCase } from "../../application/use-cases/retrieve-organization.use-case";
import { toOrganizationDto } from "../../mappers/organization.mapper";
import { retrieveOrganizationParamsSchema } from "../validators/retrieve-organization.validator";
import { errorResponse, type HandlerResponse } from "./create-organization.handler";
import { extractBearerToken } from "./extract-bearer-token";

/**
 * Framework-agnostic Route Handler for
 * GET /api/v1/management/organizations/:organizationId (API_SPEC.md §22
 * "Retrieve Organization"; STORY-003-002). Only extracts the bearer token,
 * validates the path parameter, invokes the Use Case, and maps the result to
 * an HTTP response — no business logic (Architecture.md "Presentation
 * Layer"). Nonexistent and inaccessible organizations both map to the same
 * 404 response — the distinction is made once, by the use case's single
 * `NOT_FOUND` error, never re-derived here.
 */
export function createRetrieveOrganizationHandler(useCase: RetrieveOrganizationUseCase) {
  return async function retrieveOrganizationHandler(
    authorizationHeader: string | null | undefined,
    params: unknown,
  ): Promise<HandlerResponse> {
    const accessToken = extractBearerToken(authorizationHeader);

    if (!accessToken) {
      return errorResponse(401, "UNAUTHORIZED", "Authentication is required.");
    }

    const parsed = retrieveOrganizationParamsSchema.safeParse(params);

    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return errorResponse(422, "VALIDATION_ERROR", "Validation failed.", details);
    }

    const result = await useCase.execute(accessToken, parsed.data.organizationId);

    if (!result.ok) {
      const error = result.error;

      if (error.type === "NOT_FOUND") {
        return errorResponse(404, "RESOURCE_NOT_FOUND", "The requested resource was not found.");
      }

      if (error.type === "UNAUTHORIZED") {
        return errorResponse(401, "UNAUTHORIZED", "Authentication is required.");
      }

      if (error.type === "ORGANIZATION_SUSPENDED") {
        return errorResponse(403, "ORGANIZATION_SUSPENDED", "This organization is suspended.");
      }

      // error.type === "UNEXPECTED" — never leak cause details to the client.
      return errorResponse(500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred.");
    }

    return {
      status: 200,
      body: { success: true, data: toOrganizationDto(result.value.organization) },
    };
  };
}
