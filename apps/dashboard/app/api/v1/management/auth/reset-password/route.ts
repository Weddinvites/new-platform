import { resetPasswordHandler } from "@allinvites/module-identity";
import { NextResponse } from "next/server";

/**
 * POST /api/v1/management/auth/reset-password — complete password recovery
 * using a token (API_SPEC.md §21a; ADR-004 governs the "management" URL
 * segment, same reasoning as the other Identity routes).
 *
 * This route is a thin adapter only: parse the body, delegate to the
 * Identity module's handler, return its response. No business logic here
 * (Architecture.md "Presentation Layer").
 */
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.json().catch(() => undefined);
  const { status, body } = await resetPasswordHandler(rawBody);
  return NextResponse.json(body, { status });
}
