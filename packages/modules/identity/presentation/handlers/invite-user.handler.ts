import { DomainError } from "@allinvites/kernel";
import type { InviteUserUseCase } from "../../application/use-cases/invite-user.use-case";
import { InvalidEmailError } from "../../domain/exceptions/invalid-email.error";
import { toInvitationDto } from "../../mappers/team-management.mapper";
import { inviteUserRequestSchema } from "../validators/invite-user.validator";
import { organizationContextQuerySchema } from "../validators/organization-context.validator";
import { extractBearerToken } from "./extract-bearer-token";
import { errorResponse, type HandlerResponse } from "./register-user.handler";
import { teamManagementAccessErrorResponse } from "./team-management-error-response";

/**
 * Framework-agnostic Route Handler for
 * POST /api/v1/management/users/invitations (STORY-002-007 approved
 * contract). Only extracts the bearer token, validates the query/body,
 * invokes the Use Case, and maps the result to an HTTP response — no
 * business logic (Architecture.md "Presentation Layer").
 */
export function createInviteUserHandler(useCase: InviteUserUseCase) {
  return async function inviteUserHandler(
    authorizationHeader: string | null | undefined,
    query: unknown,
    rawBody: unknown,
  ): Promise<HandlerResponse> {
    const accessToken = extractBearerToken(authorizationHeader);
    if (!accessToken) {
      return errorResponse(401, "UNAUTHORIZED", "Authentication is required.");
    }

    const parsedQuery = organizationContextQuerySchema.safeParse(query);
    if (!parsedQuery.success) {
      return errorResponse(422, "VALIDATION_ERROR", "organization_id is required.");
    }

    const parsedBody = inviteUserRequestSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      const details = parsedBody.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return errorResponse(422, "VALIDATION_ERROR", "Validation failed.", details);
    }

    const result = await useCase.execute(accessToken, {
      organizationId: parsedQuery.data.organization_id,
      email: parsedBody.data.email,
      role: parsedBody.data.role,
    });

    if (!result.ok) {
      const error = result.error;

      if (error instanceof InvalidEmailError) {
        return errorResponse(422, "VALIDATION_ERROR", error.message);
      }

      if (error instanceof DomainError) {
        // error.code === "INVITATION_ALREADY_PENDING" — the approved
        // contract's own wire code.
        return errorResponse(409, error.code, error.message);
      }

      return teamManagementAccessErrorResponse(error);
    }

    return { status: 201, body: { success: true, data: toInvitationDto(result.value.invitation) } };
  };
}
