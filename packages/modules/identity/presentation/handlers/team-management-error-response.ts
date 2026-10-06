import { errorResponse, type HandlerResponse } from "./register-user.handler";

export type TeamManagementAccessError =
  | { readonly type: "UNAUTHORIZED" }
  | { readonly type: "FORBIDDEN" }
  | { readonly type: "NOT_FOUND" }
  | { readonly type: "UNEXPECTED"; readonly cause: unknown };

/**
 * STORY-002-007 — maps the caller-resolution/access errors shared by every
 * team-management use case (`resolveAuthorizedCaller`, plus the common
 * `NOT_FOUND` target-lookup outcome) to their HTTP response, per the
 * approved contract's identical 401/403/404/500 shape across all 8
 * operations. Never leaks `cause` details to the client.
 */
export function teamManagementAccessErrorResponse(
  error: TeamManagementAccessError,
): HandlerResponse {
  switch (error.type) {
    case "UNAUTHORIZED":
      return errorResponse(401, "UNAUTHORIZED", "Authentication is required.");
    case "FORBIDDEN":
      return errorResponse(403, "FORBIDDEN", "You are not allowed to perform this operation.");
    case "NOT_FOUND":
      return errorResponse(404, "RESOURCE_NOT_FOUND", "The requested resource was not found.");
    case "UNEXPECTED":
      return errorResponse(500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred.");
  }
}
