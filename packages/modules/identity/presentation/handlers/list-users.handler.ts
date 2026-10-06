import type { ListUsersUseCase } from "../../application/use-cases/list-users.use-case";
import { toUserMembershipDto } from "../../mappers/team-management.mapper";
import { listUsersQuerySchema } from "../validators/organization-context.validator";
import { extractBearerToken } from "./extract-bearer-token";
import { errorResponse, type HandlerResponse } from "./register-user.handler";
import { teamManagementAccessErrorResponse } from "./team-management-error-response";

/**
 * Framework-agnostic Route Handler for GET /api/v1/management/users
 * (STORY-002-007 approved contract). Standard pagination envelope
 * (API_SPEC.md §16).
 */
export function createListUsersHandler(useCase: ListUsersUseCase) {
  return async function listUsersHandler(
    authorizationHeader: string | null | undefined,
    query: unknown,
  ): Promise<HandlerResponse> {
    const accessToken = extractBearerToken(authorizationHeader);
    if (!accessToken) {
      return errorResponse(401, "UNAUTHORIZED", "Authentication is required.");
    }

    const parsedQuery = listUsersQuerySchema.safeParse(query);
    if (!parsedQuery.success) {
      const details = parsedQuery.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return errorResponse(422, "VALIDATION_ERROR", "Validation failed.", details);
    }

    const result = await useCase.execute(accessToken, {
      organizationId: parsedQuery.data.organization_id,
      page: parsedQuery.data.page,
      pageSize: parsedQuery.data.pageSize,
    });

    if (!result.ok) {
      return teamManagementAccessErrorResponse(result.error);
    }

    const { page, pageSize } = parsedQuery.data;
    const totalItems = result.value.total;

    return {
      status: 200,
      body: {
        success: true,
        data: result.value.items.map(toUserMembershipDto),
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages: Math.ceil(totalItems / pageSize),
        },
      },
    };
  };
}
