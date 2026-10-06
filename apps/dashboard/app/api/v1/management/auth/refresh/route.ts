import { refreshSessionHandler } from "@allinvites/module-identity";
import { NextResponse } from "next/server";

/**
 * POST /api/v1/management/auth/refresh — exchange a refresh token for a new
 * session (API_SPEC.md §21a "Existing Authentication Endpoints"; ADR-004
 * governs the "management" URL segment, same reasoning as the other
 * Identity routes).
 *
 * This route is a thin adapter only: parse the body, delegate to the
 * Identity module's handler, return its response. No business logic here
 * (Architecture.md "Presentation Layer").
 */
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.json().catch(() => undefined);
  const { status, body } = await refreshSessionHandler(rawBody);
  return NextResponse.json(body, { status });
}
