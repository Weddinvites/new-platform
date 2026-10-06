import type { ActivateUserUseCase } from "../../application/use-cases/activate-user.use-case";
import { organizationContextQuerySchema } from "../validators/organization-context.validator";
import { extractBearerToken } from "./extract-bearer-token";
import { errorResponse, type HandlerResponse } from "./register-user.handler";
import { teamManagementAccessErrorResponse } from "./team-management-error-response";

/**
 * Framework-agnostic Route Handler for
 * POST /api/v1/management/users/{userId}/activate (STORY-002-007 approved
 * contract). SUSPENDED -> ACTIVE.
 */
export function createActivateUserHandler(useCase: ActivateUserUseCase) {
  return async function activateUserHandler(
    authorizationHeader: string | null | undefined,
    query: unknown,
    targetUserId: string,
  ): Promise<HandlerResponse> {
    const accessToken = extractBearerToken(authorizationHeader);
    if (!accessToken) {
      return errorResponse(401, "UNAUTHORIZED", "Authentication is required.");
    }

    const parsedQuery = organizationContextQuerySchema.safeParse(query);
    if (!parsedQuery.success) {
      return errorResponse(422, "VALIDATION_ERROR", "organization_id is required.");
    }

    const result = await useCase.execute(accessToken, {
      organizationId: parsedQuery.data.organization_id,
      targetUserId,
    });

    if (!result.ok) {
      return teamManagementAccessErrorResponse(result.error);
    }

    return { status: 200, body: { success: true } };
  };
}
