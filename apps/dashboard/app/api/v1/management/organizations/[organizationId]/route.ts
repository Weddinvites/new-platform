import {
  retrieveOrganizationHandler,
  updateOrganizationHandler,
} from "@allinvites/module-organizations";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ organizationId: string }> };

/**
 * GET /api/v1/management/organizations/{organizationId} — STORY-003-002
 * Retrieve Organization (API_SPEC.md §22; EPIC_003_ORGANIZATIONS.md).
 *
 * Thin adapter only: read the Authorization header and the path parameter,
 * delegate to the Organizations module's handler, return its response. No
 * business logic here (Architecture.md "Presentation Layer").
 */
export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { organizationId } = await context.params;
  const authorizationHeader = request.headers.get("authorization");
  const { status, body } = await retrieveOrganizationHandler(authorizationHeader, {
    organizationId,
  });
  return NextResponse.json(body, { status });
}

/**
 * PATCH /api/v1/management/organizations/{organizationId} — STORY-003-003
 * Update Organization (API_SPEC.md §22; EPIC_003_ORGANIZATIONS.md).
 *
 * Thin adapter only: read the Authorization header, the path parameter, and
 * the JSON body, delegate to the Organizations module's handler, return its
 * response. No business logic here (Architecture.md "Presentation Layer").
 */
export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const { organizationId } = await context.params;
  const authorizationHeader = request.headers.get("authorization");
  const rawBody = await request.json().catch(() => undefined);
  const { status, body } = await updateOrganizationHandler(
    authorizationHeader,
    { organizationId },
    rawBody,
  );
  return NextResponse.json(body, { status });
}
