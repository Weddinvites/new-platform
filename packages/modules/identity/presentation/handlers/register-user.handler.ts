import { DomainError } from "@allinvites/kernel";
import type { RegisterUserUseCase } from "../../application/use-cases/register-user.use-case";
import { toRegisteredUserDto } from "../../mappers/user.mapper";
import { registerUserRequestSchema } from "../validators/register-user.validator";

export type HandlerResponse = {
  status: number;
  body: unknown;
};

export function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): HandlerResponse {
  return {
    status,
    body: { success: false, error: { code, message, ...(details ? { details } : {}) } },
  };
}

/**
 * Framework-agnostic Route Handler for POST /auth/register (API_SPEC.md
 * §21a). Only validates, invokes the Use Case, and maps the result to an
 * HTTP response — no business logic (Architecture.md "Presentation Layer").
 */
export function createRegisterUserHandler(useCase: RegisterUserUseCase) {
  return async function registerUserHandler(rawBody: unknown): Promise<HandlerResponse> {
    const parsed = registerUserRequestSchema.safeParse(rawBody);

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
      fullName: parsed.data.full_name,
      ...(parsed.data.invitation_token !== undefined
        ? { invitationToken: parsed.data.invitation_token }
        : {}),
    });

    if (!result.ok) {
      const error = result.error;

      if (error instanceof DomainError) {
        const status = error.code === "ACCOUNT_ALREADY_EXISTS" ? 409 : 400;
        return errorResponse(status, error.code, error.message);
      }

      if (error.type === "SYSTEM_ORGANIZATION_NOT_CONFIGURED") {
        return errorResponse(500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred.");
      }

      // error.type === "UNEXPECTED" — never leak cause details to the client.
      return errorResponse(500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred.");
    }

    return { status: 201, body: { success: true, data: toRegisteredUserDto(result.value) } };
  };
}
