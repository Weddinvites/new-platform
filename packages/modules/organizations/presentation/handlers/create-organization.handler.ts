import type { CreateOrganizationUseCase } from "../../application/use-cases/create-organization.use-case";
import { InvalidSlugError } from "../../domain/exceptions/invalid-slug.error";
import { OrganizationSlugAlreadyExistsError } from "../../domain/exceptions/organization-slug-already-exists.error";
import { toCreatedOrganizationDto } from "../../mappers/organization.mapper";
import { createOrganizationRequestSchema } from "../validators/create-organization.validator";
import { extractBearerToken } from "./extract-bearer-token";

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
 * Framework-agnostic Route Handler for POST /api/v1/management/organizations
 * (API_SPEC.md §22 "Create Organization"; STORY-003-001,
 * EPIC_003_ORGANIZATIONS.md). Only extracts the bearer token, validates the
 * body, invokes the Use Case, and maps the result to an HTTP response — no
 * business logic (Architecture.md "Presentation Layer").
 */
export function createCreateOrganizationHandler(useCase: CreateOrganizationUseCase) {
  return async function createOrganizationHandler(
    authorizationHeader: string | null | undefined,
    rawBody: unknown,
  ): Promise<HandlerResponse> {
    const accessToken = extractBearerToken(authorizationHeader);

    if (!accessToken) {
      return errorResponse(401, "UNAUTHORIZED", "Authentication is required.");
    }

    const parsed = createOrganizationRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return errorResponse(422, "VALIDATION_ERROR", "Validation failed.", details);
    }

    const result = await useCase.execute(accessToken, {
      displayName: parsed.data.display_name,
      ...(parsed.data.slug !== undefined ? { slug: parsed.data.slug } : {}),
    });

    if (!result.ok) {
      const error = result.error;

      if (error instanceof InvalidSlugError) {
        return errorResponse(422, "VALIDATION_ERROR", error.message);
      }

      if (error instanceof OrganizationSlugAlreadyExistsError) {
        return errorResponse(409, error.code, error.message);
      }

      if (error.type === "UNAUTHORIZED") {
        return errorResponse(401, "UNAUTHORIZED", "Authentication is required.");
      }

      // error.type === "UNEXPECTED" — never leak cause details to the client.
      return errorResponse(500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred.");
    }

    return { status: 201, body: { success: true, data: toCreatedOrganizationDto(result.value) } };
  };
}
