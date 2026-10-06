import { listUsersHandler } from "@allinvites/module-identity";
import { NextResponse } from "next/server";

/**
 * GET /api/v1/management/users — STORY-002-007 List Users (approved
 * contract; ADR-004 governs the "management" URL segment).
 *
 * Thin adapter only: read the Authorization header and query parameters
 * (`organization_id`, `page`, `pageSize`), delegate to the Identity module's
 * handler, return its response. No business logic here
 * (Architecture.md "Presentation Layer").
 */
export async function GET(request: Request): Promise<Response> {
  const authorizationHeader = request.headers.get("authorization");
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const { status, body } = await listUsersHandler(authorizationHeader, query);
  return NextResponse.json(body, { status });
}
