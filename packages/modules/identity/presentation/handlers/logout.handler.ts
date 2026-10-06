import type { LogoutUseCase } from "../../application/use-cases/logout.use-case";
import { extractBearerToken } from "./extract-bearer-token";
import { errorResponse, type HandlerResponse } from "./register-user.handler";

/**
 * Framework-agnostic Route Handler for POST /auth/logout (API_SPEC.md §21a
 * "Existing Authentication Endpoints"). The endpoint's documented
 * "Authentication requirement: Required" is enforced with the same
 * UNAUTHORIZED code/status used for `GET /auth/me` — the doc shows no
 * separate error example for logout, but both endpoints share identical
 * "Required" language, so the same convention applies here.
 */
export function createLogoutHandler(useCase: LogoutUseCase) {
  return async function logoutHandler(
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

    return { status: 200, body: { success: true } };
  };
}
