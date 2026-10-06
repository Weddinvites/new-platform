import { assignUserRoleHandler } from "@allinvites/module-identity";
import { NextResponse } from "next/server";

/**
 * POST /api/v1/management/users/{userId}/role — STORY-002-007 Assign Role
 * (approved contract; ADR-004 governs the "management" URL segment).
 *
 * Thin adapter only: read the Authorization header, the `organization_id`
 * query parameter, the path parameter, and the body, delegate to the
 * Identity module's handler, return its response. No business logic here
 * (Architecture.md "Presentation Layer").
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
): Promise<Response> {
  const { userId } = await context.params;
  const authorizationHeader = request.headers.get("authorization");
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const rawBody = await request.json().catch(() => undefined);
  const { status, body } = await assignUserRoleHandler(authorizationHeader, query, userId, rawBody);
  return NextResponse.json(body, { status });
}
