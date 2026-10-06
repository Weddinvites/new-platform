import {
  createOrganizationHandler,
  listOrganizationsHandler,
} from "@allinvites/module-organizations";
import { NextResponse } from "next/server";

/**
 * POST /api/v1/management/organizations — STORY-003-001 Create Organization.
 * GET /api/v1/management/organizations — STORY-003-002 List Organizations
 * (API_SPEC.md §22; EPIC_003_ORGANIZATIONS.md).
 *
 * Thin adapters only: read the Authorization header and (for POST) the body,
 * or (for GET) the pagination query parameters, delegate to the
 * Organizations module's handler, return its response. No business logic
 * here (Architecture.md "Presentation Layer").
 */
export async function POST(request: Request): Promise<Response> {
  const authorizationHeader = request.headers.get("authorization");
  const rawBody = await request.json().catch(() => undefined);
  const { status, body } = await createOrganizationHandler(authorizationHeader, rawBody);
  return NextResponse.json(body, { status });
}

export async function GET(request: Request): Promise<Response> {
  const authorizationHeader = request.headers.get("authorization");
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const { status, body } = await listOrganizationsHandler(authorizationHeader, query);
  return NextResponse.json(body, { status });
}
