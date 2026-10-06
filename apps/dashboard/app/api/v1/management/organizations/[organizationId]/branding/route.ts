import {
  retrieveOrganizationBrandingHandler,
  updateOrganizationBrandingHandler,
} from "@allinvites/module-organizations";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ organizationId: string }> };

/**
 * GET /api/v1/management/organizations/{organizationId}/branding —
 * STORY-003-005 Retrieve Organization Branding (API_SPEC.md §22 "Configure
 * White Label"; EPIC_003_ORGANIZATIONS.md).
 * PATCH — Update Organization Branding.
 *
 * Thin adapters only: read the Authorization header, the path parameter,
 * and (for PATCH) the JSON body, delegate to the Organizations module's
 * handler, return its response. No business logic here (Architecture.md
 * "Presentation Layer").
 */
export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { organizationId } = await context.params;
  const authorizationHeader = request.headers.get("authorization");
  const { status, body } = await retrieveOrganizationBrandingHandler(authorizationHeader, {
    organizationId,
  });
  return NextResponse.json(body, { status });
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const { organizationId } = await context.params;
  const authorizationHeader = request.headers.get("authorization");
  const rawBody = await request.json().catch(() => undefined);
  const { status, body } = await updateOrganizationBrandingHandler(
    authorizationHeader,
    { organizationId },
    rawBody,
  );
  return NextResponse.json(body, { status });
}
