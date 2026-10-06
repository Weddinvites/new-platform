import type { UpdateOrganizationUseCase } from "../../application/use-cases/update-organization.use-case";
import { toOrganizationDto } from "../../mappers/organization.mapper";
import {
  updateOrganizationParamsSchema,
  updateOrganizationRequestSchema,
} from "../validators/update-organization.validator";
import { errorResponse, type HandlerResponse } from "./create-organization.handler";
import { extractBearerToken } from "./extract-bearer-token";

/**
 * Framework-agnostic Route Handler for
 * PATCH /api/v1/management/organizations/:organizationId (API_SPEC.md §22
 * "Update Organization"; STORY-003-003). Only extracts the bearer token,
 * validates the path parameter and body, invokes the Use Case, and maps the
 * result to an HTTP response — no business logic (Architecture.md
 * "Presentation Layer"). Nonexistent organizations, callers with no ACTIVE
 * membership, and SYSTEM-typed organizations all map to the same 404
 * response — the distinction is made once, by the use case's single
 * `NOT_FOUND` error, never re-derived here.
 */
export function createUpdateOrganizationHandler(useCase: UpdateOrganizationUseCase) {
  return async function updateOrganizationHandler(
    authorizationHeader: string | null | undefined,
    params: unknown,
    rawBody: unknown,
  ): Promise<HandlerResponse> {
    const accessToken = extractBearerToken(authorizationHeader);

    if (!accessToken) {
      return errorResponse(401, "UNAUTHORIZED", "Authentication is required.");
    }

    const parsedParams = updateOrganizationParamsSchema.safeParse(params);

    if (!parsedParams.success) {
      const details = parsedParams.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return errorResponse(422, "VALIDATION_ERROR", "Validation failed.", details);
    }

    const parsedBody = updateOrganizationRequestSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      const details = parsedBody.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return errorResponse(422, "VALIDATION_ERROR", "Validation failed.", details);
    }

    const result = await useCase.execute(accessToken, {
      organizationId: parsedParams.data.organizationId,
      displayName: parsedBody.data.display_name,
    });

    if (!result.ok) {
      const error = result.error;

      if (error.type === "NOT_FOUND") {
        return errorResponse(404, "RESOURCE_NOT_FOUND", "The requested resource was not found.");
      }

      if (error.type === "FORBIDDEN") {
        return errorResponse(403, "FORBIDDEN", "You are not allowed to perform this operation.");
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
