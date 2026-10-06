import type { InitiatePasswordRecoveryUseCase } from "../../application/use-cases/initiate-password-recovery.use-case";
import { forgotPasswordRequestSchema } from "../validators/forgot-password.validator";
import { errorResponse, type HandlerResponse } from "./register-user.handler";

/**
 * Framework-agnostic Route Handler for POST /auth/forgot-password
 * (API_SPEC.md §21a "Existing Authentication Endpoints"). Only validates,
 * invokes the Use Case, and maps the result to an HTTP response — no
 * business logic (Architecture.md "Presentation Layer").
 */
export function createForgotPasswordHandler(useCase: InitiatePasswordRecoveryUseCase) {
  return async function forgotPasswordHandler(rawBody: unknown): Promise<HandlerResponse> {
    const parsed = forgotPasswordRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return errorResponse(422, "VALIDATION_ERROR", "Validation failed.", details);
    }

    const result = await useCase.execute(parsed.data.email);

    if (!result.ok) {
      // error.type === "UNEXPECTED" — never leak cause details to the client.
      return errorResponse(500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred.");
    }

    return { status: 200, body: { success: true } };
  };
}
