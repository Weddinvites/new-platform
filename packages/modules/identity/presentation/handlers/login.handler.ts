import { DomainError } from "@allinvites/kernel";
import type { LoginUserUseCase } from "../../application/use-cases/login-user.use-case";
import { toLoginResponseDto } from "../../mappers/session.mapper";
import { loginRequestSchema } from "../validators/login.validator";
import { errorResponse, type HandlerResponse } from "./register-user.handler";

/**
 * Framework-agnostic Route Handler for POST /auth/login (API_SPEC.md
 * §21a "Existing Authentication Endpoints"). Only validates, invokes the
 * Use Case, and maps the result to an HTTP response — no business logic
 * (Architecture.md "Presentation Layer").
 */
export function createLoginHandler(useCase: LoginUserUseCase) {
  return async function loginHandler(rawBody: unknown): Promise<HandlerResponse> {
    const parsed = loginRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return errorResponse(422, "VALIDATION_ERROR", "Validation failed.", details);
    }

    const result = await useCase.execute({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (!result.ok) {
      const error = result.error;

      if (error instanceof DomainError) {
        return errorResponse(401, error.code, error.message);
      }

      // error.type === "UNEXPECTED" — never leak cause details to the client.
      return errorResponse(500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred.");
    }

    return { status: 200, body: { success: true, data: toLoginResponseDto(result.value) } };
  };
}
