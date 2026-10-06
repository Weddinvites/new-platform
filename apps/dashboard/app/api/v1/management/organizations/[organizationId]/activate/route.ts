import { activateOrganizationHandler } from "@allinvites/module-organizations";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ organizationId: string }> };

/**
 * POST /api/v1/management/organizations/{organizationId}/activate — STORY-003-004
 * Activate Organization (API_SPEC.md §22; EPIC_003_ORGANIZATIONS.md).
 *
 * Thin adapter only: read the Authorization header and the path parameter,
 * delegate to the Organizations module's handler, return its response. No
 * business logic here (Architecture.md "Presentation Layer").
 */
export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { organizationId } = await context.params;
  const authorizationHeader = request.headers.get("authorization");
  const { status, body } = await activateOrganizationHandler(authorizationHeader, {
    organizationId,
  });
  return NextResponse.json(body, { status });
}
