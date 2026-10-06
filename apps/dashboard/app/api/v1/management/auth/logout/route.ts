import { logoutHandler } from "@allinvites/module-identity";
import { NextResponse } from "next/server";

/**
 * POST /api/v1/management/auth/logout — terminate the current session
 * (API_SPEC.md §21a "Existing Authentication Endpoints"; ADR-004 governs the
 * "management" URL segment, same reasoning as the other Identity routes).
 *
 * This route is a thin adapter only: read the Authorization header, delegate
 * to the Identity module's handler, return its response. No business logic
 * here (Architecture.md "Presentation Layer").
 */
export async function POST(request: Request): Promise<Response> {
  const authorizationHeader = request.headers.get("authorization");
  const { status, body } = await logoutHandler(authorizationHeader);
  return NextResponse.json(body, { status });
}
