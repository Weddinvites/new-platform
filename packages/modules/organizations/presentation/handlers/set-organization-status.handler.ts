import type { SetOrganizationStatusUseCase } from "../../application/use-cases/set-organization-status.use-case";
import { toOrganizationStatusDto } from "../../mappers/organization.mapper";
import { retrieveOrganizationParamsSchema } from "../validators/retrieve-organization.validator";
import { errorResponse, type HandlerResponse } from "./create-organization.handler";
import { extractBearerToken } from "./extract-bearer-token";

/**
 * Framework-agnostic Route Handler factory for
 * POST /api/v1/management/organizations/:organizationId/suspend and
 * .../activate (API_SPEC.md §22; STORY-003-004). The target status is fixed
 * per route, so each route gets its own handler and the body is ignored.
 * Only extracts the bearer token, validates the path parameter, invokes the
 * use case, and maps the result to an HTTP response (Architecture.md
 * "Presentation Layer").
 */
export function createSetOrganizationStatusHandler(
  useCase: SetOrganizationStatusUseCase,
  status: "ACTIVE" | "SUSPENDED",
) {
  return async function setOrganizationStatusHandler(
    authorizationHeader: string | null | undefined,
    params: unknown,
  ): Promise<HandlerResponse> {
    const accessToken = extractBearerToken(authorizationHeader);

    if (!accessToken) {
      return errorResponse(401, "UNAUTHORIZED", "Authentication is required.");
    }

    const parsedParams = retrieveOrganizationParamsSchema.safeParse(params);

    if (!parsedParams.success) {
      const details = parsedParams.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return errorResponse(422, "VALIDATION_ERROR", "Validation failed.", details);
    }

    const result = await useCase.execute(accessToken, {
      organizationId: parsedParams.data.organizationId,
      status,
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

      // error.type === "UNEXPECTED" — never leak cause details to the client.
      return errorResponse(500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred.");
    }

    return {
      status: 200,
      body: { success: true, data: toOrganizationStatusDto(result.value.organization) },
    };
  };
}
