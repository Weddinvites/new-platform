import { activateUserHandler } from "@allinvites/module-identity";
import { NextResponse } from "next/server";

/**
 * POST /api/v1/management/users/{userId}/activate — STORY-002-007 Activate
 * User (approved contract; ADR-004 governs the "management" URL segment).
 *
 * Thin adapter only: read the Authorization header, the `organization_id`
 * query parameter, and the path parameter, delegate to the Identity
 * module's handler, return its response. No business logic here
 * (Architecture.md "Presentation Layer").
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
): Promise<Response> {
  const { userId } = await context.params;
  const authorizationHeader = request.headers.get("authorization");
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const { status, body } = await activateUserHandler(authorizationHeader, query, userId);
  return NextResponse.json(body, { status });
}
