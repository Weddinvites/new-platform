import { inviteUserHandler } from "@allinvites/module-identity";
import { NextResponse } from "next/server";

/**
 * POST /api/v1/management/users/invitations — STORY-002-007 Invite User
 * (approved contract; ADR-004 governs the "management" URL segment, same
 * reasoning as the other Identity routes).
 *
 * This route is a thin adapter only: read the Authorization header, the
 * `organization_id` query parameter, and the body, delegate to the Identity
 * module's handler, return its response. No business logic here
 * (Architecture.md "Presentation Layer").
 */
export async function POST(request: Request): Promise<Response> {
  const authorizationHeader = request.headers.get("authorization");
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const rawBody = await request.json().catch(() => undefined);
  const { status, body } = await inviteUserHandler(authorizationHeader, query, rawBody);
  return NextResponse.json(body, { status });
}
