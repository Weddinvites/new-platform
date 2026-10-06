import type { UpdateOrganizationBrandingUseCase } from "../../application/use-cases/update-organization-branding.use-case";
import { toOrganizationBrandingDto } from "../../mappers/organization.mapper";
import {
  organizationBrandingParamsSchema,
  updateOrganizationBrandingRequestSchema,
} from "../validators/organization-branding.validator";
import { errorResponse, type HandlerResponse } from "./create-organization.handler";
import { extractBearerToken } from "./extract-bearer-token";

/**
 * Framework-agnostic Route Handler for
 * PATCH /api/v1/management/organizations/:organizationId/branding
 * (API_SPEC.md §22 "Configure White Label"; STORY-003-005). Only extracts
 * the bearer token, validates the path parameter and body, invokes the Use
 * Case, and maps the result to an HTTP response — no business logic
 * (Architecture.md "Presentation Layer"). Nonexistent organizations,
 * callers with no membership, and SYSTEM-typed organizations all map to the
 * same 404 response — the distinction is made once, by the use case's
 * single `NOT_FOUND` error, never re-derived here.
 */
export function createUpdateOrganizationBrandingHandler(
  useCase: UpdateOrganizationBrandingUseCase,
) {
  return async function updateOrganizationBrandingHandler(
    authorizationHeader: string | null | undefined,
    params: unknown,
    rawBody: unknown,
  ): Promise<HandlerResponse> {
    const accessToken = extractBearerToken(authorizationHeader);

    if (!accessToken) {
      return errorResponse(401, "UNAUTHORIZED", "Authentication is required.");
    }

    const parsedParams = organizationBrandingParamsSchema.safeParse(params);

    if (!parsedParams.success) {
      const details = parsedParams.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return errorResponse(422, "VALIDATION_ERROR", "Validation failed.", details);
    }

    const parsedBody = updateOrganizationBrandingRequestSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      const details = parsedBody.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return errorResponse(422, "VALIDATION_ERROR", "Validation failed.", details);
    }

    const result = await useCase.execute(accessToken, {
      organizationId: parsedParams.data.organizationId,
      ...(parsedBody.data.brand_name !== undefined
        ? { brandName: parsedBody.data.brand_name }
        : {}),
      ...(parsedBody.data.logo !== undefined ? { logo: parsedBody.data.logo } : {}),
      ...(parsedBody.data.primary_color !== undefined
        ? { primaryColor: parsedBody.data.primary_color }
        : {}),
      ...(parsedBody.data.secondary_color !== undefined
        ? { secondaryColor: parsedBody.data.secondary_color }
        : {}),
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
      body: { success: true, data: toOrganizationBrandingDto(result.value.organization) },
    };
  };
}
