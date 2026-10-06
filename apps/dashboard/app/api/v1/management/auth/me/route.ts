import { meHandler } from "@allinvites/module-identity";
import { NextResponse } from "next/server";

/**
 * GET /api/v1/management/auth/me — current authenticated User + Organization
 * Memberships (API_SPEC.md §21a "Current User"; ADR-004 governs the
 * "management" URL segment, same reasoning as the other Identity routes).
 *
 * This route is a thin adapter only: read the Authorization header, delegate
 * to the Identity module's handler, return its response. No business logic
 * here (Architecture.md "Presentation Layer").
 */
export async function GET(request: Request): Promise<Response> {
  const authorizationHeader = request.headers.get("authorization");
  const { status, body } = await meHandler(authorizationHeader);
  return NextResponse.json(body, { status });
}
