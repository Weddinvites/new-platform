import type { UpdateUserUseCase } from "../../application/use-cases/update-user.use-case";
import { InvalidFullNameError } from "../../domain/exceptions/invalid-full-name.error";
import { organizationContextQuerySchema } from "../validators/organization-context.validator";
import { updateUserRequestSchema } from "../validators/update-user.validator";
import { extractBearerToken } from "./extract-bearer-token";
import { errorResponse, type HandlerResponse } from "./register-user.handler";
import { teamManagementAccessErrorResponse } from "./team-management-error-response";

/**
 * Framework-agnostic Route Handler for
 * PATCH /api/v1/management/users/{userId} (STORY-002-007 approved
 * contract). `InvalidFullNameError` maps to 422 VALIDATION_ERROR, same
 * convention as self-service `POST /auth/profile`.
 */
export function createUpdateUserHandler(useCase: UpdateUserUseCase) {
  return async function updateUserHandler(
    authorizationHeader: string | null | undefined,
    query: unknown,
    targetUserId: string,
    rawBody: unknown,
  ): Promise<HandlerResponse> {
    const accessToken = extractBearerToken(authorizationHeader);
    if (!accessToken) {
      return errorResponse(401, "UNAUTHORIZED", "Authentication is required.");
    }

    const parsedQuery = organizationContextQuerySchema.safeParse(query);
    if (!parsedQuery.success) {
      return errorResponse(422, "VALIDATION_ERROR", "organization_id is required.");
    }

    const parsedBody = updateUserRequestSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      const details = parsedBody.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return errorResponse(422, "VALIDATION_ERROR", "Validation failed.", details);
    }

    const result = await useCase.execute(accessToken, {
      organizationId: parsedQuery.data.organization_id,
      targetUserId,
      fullName: parsedBody.data.full_name,
    });

    if (!result.ok) {
      const error = result.error;

      if (error instanceof InvalidFullNameError) {
        return errorResponse(422, "VALIDATION_ERROR", error.message);
      }

      return teamManagementAccessErrorResponse(error);
    }

    return { status: 200, body: { success: true } };
  };
}
