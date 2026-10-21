import { retrieveSubscriptionHandler } from "@allinvites/module-organizations";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ organizationId: string }> };

/**
 * GET /api/v1/management/organizations/{organizationId}/subscription —
 * STORY-004-001 Retrieve Subscription (API_SPEC.md §30 "Billing API").
 *
 * Thin adapter only: read the Authorization header and the path parameter,
 * delegate to the Organizations module's handler, return its response. No
 * business logic here (Architecture.md "Presentation Layer").
 */
export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { organizationId } = await context.params;
  const authorizationHeader = request.headers.get("authorization");
  const { status, body } = await retrieveSubscriptionHandler(authorizationHeader, {
    organizationId,
  });
  return NextResponse.json(body, { status });
}
