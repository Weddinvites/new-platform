import { DomainError } from "@allinvites/kernel";
import type { ChangePasswordUseCase } from "../../application/use-cases/change-password.use-case";
import { InvalidPasswordError } from "../../domain/exceptions/invalid-password.error";
import { changePasswordRequestSchema } from "../validators/change-password.validator";
import { extractBearerToken } from "./extract-bearer-token";
import { errorResponse, type HandlerResponse } from "./register-user.handler";

/**
 * Framework-agnostic Route Handler for POST /auth/change-password
 * (API_SPEC.md §23 "Change Password", contract finalized alongside this
 * Story). Only extracts the bearer token, validates the body, invokes the
 * Use Case, and maps the result to an HTTP response — no business logic
 * (Architecture.md "Presentation Layer").
 *
 * `InvalidPasswordError` maps to 422 VALIDATION_ERROR here (not 400, unlike
 * `POST /auth/reset-password`) — the finalized Change Password contract
 * defines exactly three error codes (VALIDATION_ERROR/INVALID_CREDENTIALS/
 * INTERNAL_SERVER_ERROR), so a new-password policy violation is folded into
 * VALIDATION_ERROR rather than introducing a fourth code.
 */
export function createChangePasswordHandler(useCase: ChangePasswordUseCase) {
  return async function changePasswordHandler(
    authorizationHeader: string | null | undefined,
    rawBody: unknown,
  ): Promise<HandlerResponse> {
    const accessToken = extractBearerToken(authorizationHeader);

    if (!accessToken) {
      return errorResponse(401, "UNAUTHORIZED", "Authentication is required.");
    }

    const parsed = changePasswordRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return errorResponse(422, "VALIDATION_ERROR", "Validation failed.", details);
    }

    const result = await useCase.execute(accessToken, {
      currentPassword: parsed.data.current_password,
      newPassword: parsed.data.new_password,
    });

    if (!result.ok) {
      const error = result.error;

      if (error instanceof InvalidPasswordError) {
        return errorResponse(422, "VALIDATION_ERROR", error.message);
      }

      if (error instanceof DomainError) {
        return errorResponse(401, error.code, error.message);
      }

      if (error.type === "UNAUTHORIZED") {
        return errorResponse(401, "UNAUTHORIZED", "Authentication is required.");
      }

      // error.type === "UNEXPECTED" — never leak cause details to the client.
      return errorResponse(500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred.");
    }

    return { status: 200, body: { success: true } };
  };
}
