import type { ResolveCurrentUserUseCase } from "../../application/use-cases/resolve-current-user.use-case";
import { toMeResponseDto } from "../../mappers/me.mapper";
import { extractBearerToken } from "./extract-bearer-token";
import { errorResponse, type HandlerResponse } from "./register-user.handler";

/**
 * Framework-agnostic Route Handler for GET /auth/me (API_SPEC.md §21a
 * "Current User"). Only extracts the bearer token, invokes the Use Case,
 * and maps the result to an HTTP response — no business logic
 * (Architecture.md "Presentation Layer").
 */
export function createMeHandler(useCase: ResolveCurrentUserUseCase) {
  return async function meHandler(
    authorizationHeader: string | null | undefined,
  ): Promise<HandlerResponse> {
    const accessToken = extractBearerToken(authorizationHeader);

    if (!accessToken) {
      return errorResponse(401, "UNAUTHORIZED", "Authentication is required.");
    }

    const result = await useCase.execute(accessToken);

    if (!result.ok) {
      if (result.error.type === "UNAUTHORIZED") {
        return errorResponse(401, "UNAUTHORIZED", "Authentication is required.");
      }
      return errorResponse(500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred.");
    }

    return { status: 200, body: { success: true, data: toMeResponseDto(result.value) } };
  };
}
