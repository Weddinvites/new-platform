import type { ListOrganizationsUseCase } from "../../application/use-cases/list-organizations.use-case";
import { toOrganizationDto } from "../../mappers/organization.mapper";
import { listOrganizationsQuerySchema } from "../validators/list-organizations.validator";
import { errorResponse, type HandlerResponse } from "./create-organization.handler";
import { extractBearerToken } from "./extract-bearer-token";

/**
 * Framework-agnostic Route Handler for GET /api/v1/management/organizations
 * (API_SPEC.md §22 "List Organizations"; STORY-003-002). Standard pagination
 * envelope (API_SPEC.md §16), no `hasPrevious`/`hasNext` — matches the
 * implemented List Users shape exactly. No business logic here
 * (Architecture.md "Presentation Layer").
 */
export function createListOrganizationsHandler(useCase: ListOrganizationsUseCase) {
  return async function listOrganizationsHandler(
    authorizationHeader: string | null | undefined,
    query: unknown,
  ): Promise<HandlerResponse> {
    const accessToken = extractBearerToken(authorizationHeader);

    if (!accessToken) {
      return errorResponse(401, "UNAUTHORIZED", "Authentication is required.");
    }

    const parsedQuery = listOrganizationsQuerySchema.safeParse(query);

    if (!parsedQuery.success) {
      const details = parsedQuery.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return errorResponse(422, "VALIDATION_ERROR", "Validation failed.", details);
    }

    const { page, pageSize } = parsedQuery.data;
    const result = await useCase.execute(accessToken, { page, pageSize });

    if (!result.ok) {
      if (result.error.type === "UNAUTHORIZED") {
        return errorResponse(401, "UNAUTHORIZED", "Authentication is required.");
      }

      // result.error.type === "UNEXPECTED" — never leak cause details to the client.
      return errorResponse(500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred.");
    }

    const totalItems = result.value.total;

    return {
      status: 200,
      body: {
        success: true,
        data: result.value.items.map(toOrganizationDto),
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
