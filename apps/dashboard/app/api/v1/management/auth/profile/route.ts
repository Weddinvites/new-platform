import { updateProfileHandler } from "@allinvites/module-identity";
import { NextResponse } from "next/server";

/**
 * POST /api/v1/management/auth/profile — update the authenticated user's
 * own `full_name` (API_SPEC.md §23 "Update User", MVP contract finalized
 * alongside STORY-002-005; ADR-004 governs the "management" URL segment,
 * same reasoning as the other Identity routes).
 *
 * This route is a thin adapter only: read the Authorization header, parse
 * the body, delegate to the Identity module's handler, return its response.
 * No business logic here (Architecture.md "Presentation Layer").
 */
export async function POST(request: Request): Promise<Response> {
  const authorizationHeader = request.headers.get("authorization");
  const rawBody = await request.json().catch(() => undefined);
  const { status, body } = await updateProfileHandler(authorizationHeader, rawBody);
  return NextResponse.json(body, { status });
}
