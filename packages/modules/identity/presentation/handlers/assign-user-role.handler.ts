import { DomainError } from "@allinvites/kernel";
import type { AssignUserRoleUseCase } from "../../application/use-cases/assign-user-role.use-case";
import { assignUserRoleRequestSchema } from "../validators/assign-user-role.validator";
import { organizationContextQuerySchema } from "../validators/organization-context.validator";
import { extractBearerToken } from "./extract-bearer-token";
import { errorResponse, type HandlerResponse } from "./register-user.handler";
import { teamManagementAccessErrorResponse } from "./team-management-error-response";

/**
 * Framework-agnostic Route Handler for
 * POST /api/v1/management/users/{userId}/role (STORY-002-007 approved
 * contract).
 */
export function createAssignUserRoleHandler(useCase: AssignUserRoleUseCase) {
  return async function assignUserRoleHandler(
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

    const parsedBody = assignUserRoleRequestSchema.safeParse(rawBody);
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
      role: parsedBody.data.role,
    });

    if (!result.ok) {
      const error = result.error;

      if (error instanceof DomainError) {
        // error.code === "CANNOT_DEMOTE_LAST_OWNER" — the approved
        // contract's own wire code.
        return errorResponse(409, error.code, error.message);
      }

      return teamManagementAccessErrorResponse(error);
    }

    return { status: 200, body: { success: true } };
  };
}
