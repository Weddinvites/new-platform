import type { UpdateUserProfileUseCase } from "../../application/use-cases/update-user-profile.use-case";
import { InvalidFullNameError } from "../../domain/exceptions/invalid-full-name.error";
import { toUpdateProfileResponseDto } from "../../mappers/update-profile.mapper";
import { updateProfileRequestSchema } from "../validators/update-profile.validator";
import { extractBearerToken } from "./extract-bearer-token";
import { errorResponse, type HandlerResponse } from "./register-user.handler";

/**
 * Framework-agnostic Route Handler for POST /auth/profile (API_SPEC.md §23
 * "Update User", MVP contract finalized alongside STORY-002-005). Only
 * extracts the bearer token, validates the body, invokes the Use Case, and
 * maps the result to an HTTP response — no business logic
 * (Architecture.md "Presentation Layer").
 *
 * `InvalidFullNameError` maps to 422 VALIDATION_ERROR (not its own domain
 * code) — the approved contract defines exactly three error codes
 * (UNAUTHORIZED/VALIDATION_ERROR/INTERNAL_SERVER_ERROR), the same convention
 * already established for `POST /auth/change-password`.
 */
export function createUpdateProfileHandler(useCase: UpdateUserProfileUseCase) {
  return async function updateProfileHandler(
    authorizationHeader: string | null | undefined,
    rawBody: unknown,
  ): Promise<HandlerResponse> {
    const accessToken = extractBearerToken(authorizationHeader);

    if (!accessToken) {
      return errorResponse(401, "UNAUTHORIZED", "Authentication is required.");
    }

    const parsed = updateProfileRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return errorResponse(422, "VALIDATION_ERROR", "Validation failed.", details);
    }

    const result = await useCase.execute(accessToken, { fullName: parsed.data.full_name });

    if (!result.ok) {
      const error = result.error;

      if (error instanceof InvalidFullNameError) {
        return errorResponse(422, "VALIDATION_ERROR", error.message);
      }

      if (error.type === "UNAUTHORIZED") {
        return errorResponse(401, "UNAUTHORIZED", "Authentication is required.");
      }

      // error.type === "UNEXPECTED" — never leak cause details to the client.
      return errorResponse(500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred.");
    }

    return { status: 200, body: { success: true, data: toUpdateProfileResponseDto(result.value) } };
  };
}
