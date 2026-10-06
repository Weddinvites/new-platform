import type { RefreshSessionUseCase } from "../../application/use-cases/refresh-session.use-case";
import { toRefreshSessionResponseDto } from "../../mappers/refresh-session.mapper";
import { refreshSessionRequestSchema } from "../validators/refresh-session.validator";
import { errorResponse, type HandlerResponse } from "./register-user.handler";

/**
 * Framework-agnostic Route Handler for POST /auth/refresh (API_SPEC.md §21a
 * "Existing Authentication Endpoints"). Only validates, invokes the Use
 * Case, and maps the result to an HTTP response — no business logic
 * (Architecture.md "Presentation Layer").
 */
export function createRefreshSessionHandler(useCase: RefreshSessionUseCase) {
  return async function refreshSessionHandler(rawBody: unknown): Promise<HandlerResponse> {
    const parsed = refreshSessionRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return errorResponse(422, "VALIDATION_ERROR", "Validation failed.", details);
    }

    const result = await useCase.execute({ refreshToken: parsed.data.refresh_token });

    if (!result.ok) {
      if (result.error.type === "UNAUTHORIZED") {
        return errorResponse(401, "UNAUTHORIZED", "The refresh token is invalid or has expired.");
      }
      return errorResponse(500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred.");
    }

    return {
      status: 200,
      body: { success: true, data: toRefreshSessionResponseDto(result.value) },
    };
  };
}
