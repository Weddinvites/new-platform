import { DomainError } from "@allinvites/kernel";
import type { RemoveUserUseCase } from "../../application/use-cases/remove-user.use-case";
import { organizationContextQuerySchema } from "../validators/organization-context.validator";
import { extractBearerToken } from "./extract-bearer-token";
import { errorResponse, type HandlerResponse } from "./register-user.handler";
import { teamManagementAccessErrorResponse } from "./team-management-error-response";

/**
 * Framework-agnostic Route Handler for
 * DELETE /api/v1/management/users/{userId} (STORY-002-007 approved
 * contract). Soft-removes the target's Organization Membership (REMOVED
 * status) — never deletes the global User/auth account.
 */
export function createRemoveUserHandler(useCase: RemoveUserUseCase) {
  return async function removeUserHandler(
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
      const error = result.error;

      if (error instanceof DomainError) {
        // error.code === "CANNOT_REMOVE_LAST_OWNER" — the approved
        // contract's own wire code.
        return errorResponse(409, error.code, error.message);
      }

      return teamManagementAccessErrorResponse(error);
    }

    return { status: 200, body: { success: true } };
  };
}
