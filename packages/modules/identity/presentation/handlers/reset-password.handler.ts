import { DomainError } from "@allinvites/kernel";
import type { ResetPasswordUseCase } from "../../application/use-cases/reset-password.use-case";
import { resetPasswordRequestSchema } from "../validators/reset-password.validator";
import { errorResponse, type HandlerResponse } from "./register-user.handler";

/**
 * Framework-agnostic Route Handler for POST /auth/reset-password
 * (API_SPEC.md §21a "Existing Authentication Endpoints"). Only validates,
 * invokes the Use Case, and maps the result to an HTTP response — no
 * business logic (Architecture.md "Presentation Layer").
 *
 * `INVALID_OR_EXPIRED_TOKEN` and `InvalidPasswordError` both map to 400 —
 * the same convention already established for the identical code at
 * `POST /auth/register` (Mission 006), kept consistent here.
 */
export function createResetPasswordHandler(useCase: ResetPasswordUseCase) {
  return async function resetPasswordHandler(rawBody: unknown): Promise<HandlerResponse> {
    const parsed = resetPasswordRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return errorResponse(422, "VALIDATION_ERROR", "Validation failed.", details);
    }

    const result = await useCase.execute({
      email: parsed.data.email,
      token: parsed.data.token,
      newPassword: parsed.data.password,
    });

    if (!result.ok) {
      const error = result.error;

      if (error instanceof DomainError) {
        return errorResponse(400, error.code, error.message);
      }

      // error.type === "UNEXPECTED" — never leak cause details to the client.
      return errorResponse(500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred.");
    }

    return { status: 200, body: { success: true } };
  };
}
