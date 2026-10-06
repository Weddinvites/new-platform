import { registerUserHandler } from "@allinvites/module-identity";
import { NextResponse } from "next/server";

/**
 * POST /api/v1/management/auth/register — self-service registration
 * (API_SPEC.md §21a; ADR-004 governs the "management" URL segment, which
 * supersedes API_SPEC.md §4's now-stale "dashboard" base path naming).
 *
 * This route is a thin adapter only: parse the body, delegate to the
 * Identity module's handler, return its response. No business logic here
 * (Architecture.md "Presentation Layer").
 */
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.json().catch(() => undefined);
  const { status, body } = await registerUserHandler(rawBody);
  return NextResponse.json(body, { status });
}
