import type { RetrieveSubscriptionUseCase } from "../../application/use-cases/retrieve-subscription.use-case";
import { toOrganizationSubscriptionDto } from "../../mappers/organization.mapper";
import { retrieveSubscriptionParamsSchema } from "../validators/retrieve-subscription.validator";
import { errorResponse, type HandlerResponse } from "./create-organization.handler";
import { extractBearerToken } from "./extract-bearer-token";

/**
 * Framework-agnostic Route Handler for
 * GET /api/v1/management/organizations/:organizationId/subscription
 * (API_SPEC.md §30 "Billing API"; STORY-004-001). Only extracts the bearer
 * token, validates the path parameter, invokes the Use Case, and maps the
 * result to an HTTP response — no business logic (Architecture.md
 * "Presentation Layer"). Deliberately stays reachable even when the
 * Subscription is Past Due.
 */
export function createRetrieveSubscriptionHandler(useCase: RetrieveSubscriptionUseCase) {
  return async function retrieveSubscriptionHandler(
    authorizationHeader: string | null | undefined,
    params: unknown,
  ): Promise<HandlerResponse> {
    const accessToken = extractBearerToken(authorizationHeader);

    if (!accessToken) {
      return errorResponse(401, "UNAUTHORIZED", "Authentication is required.");
    }

    const parsedParams = retrieveSubscriptionParamsSchema.safeParse(params);

    if (!parsedParams.success) {
      const details = parsedParams.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return errorResponse(422, "VALIDATION_ERROR", "Validation failed.", details);
    }

    const result = await useCase.execute(accessToken, parsedParams.data.organizationId);

    if (!result.ok) {
      const error = result.error;

      if (error.type === "NOT_FOUND") {
        return errorResponse(404, "RESOURCE_NOT_FOUND", "The requested resource was not found.");
      }

      if (error.type === "UNAUTHORIZED") {
        return errorResponse(401, "UNAUTHORIZED", "Authentication is required.");
      }

      // error.type === "UNEXPECTED" — never leak cause details to the client.
      return errorResponse(500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred.");
    }

    return {
      status: 200,
      body: { success: true, data: toOrganizationSubscriptionDto(result.value) },
    };
  };
}
