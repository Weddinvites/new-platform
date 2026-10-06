import { changePasswordHandler } from "@allinvites/module-identity";
import { NextResponse } from "next/server";

/**
 * POST /api/v1/management/auth/change-password — authenticated-user
 * password change (API_SPEC.md §23 "Change Password"; ADR-004 governs the
 * "management" URL segment, same reasoning as the other Identity routes).
 *
 * This route is a thin adapter only: read the Authorization header, parse
 * the body, delegate to the Identity module's handler, return its response.
 * No business logic here (Architecture.md "Presentation Layer").
 */
export async function POST(request: Request): Promise<Response> {
  const authorizationHeader = request.headers.get("authorization");
  const rawBody = await request.json().catch(() => undefined);
  const { status, body } = await changePasswordHandler(authorizationHeader, rawBody);
  return NextResponse.json(body, { status });
}
