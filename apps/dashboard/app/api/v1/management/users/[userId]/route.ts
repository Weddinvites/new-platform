import { getUserHandler, removeUserHandler, updateUserHandler } from "@allinvites/module-identity";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ userId: string }> };

/**
 * GET /api/v1/management/users/{userId} — STORY-002-007 Retrieve User.
 * PATCH — Update User. DELETE — Remove User (approved contract; ADR-004
 * governs the "management" URL segment).
 *
 * Thin adapters only: read the Authorization header, the `organization_id`
 * query parameter, the path parameter, and (for PATCH) the body, delegate
 * to the Identity module's handler, return its response. No business logic
 * here (Architecture.md "Presentation Layer").
 */
export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { userId } = await context.params;
  const authorizationHeader = request.headers.get("authorization");
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const { status, body } = await getUserHandler(authorizationHeader, query, userId);
  return NextResponse.json(body, { status });
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const { userId } = await context.params;
  const authorizationHeader = request.headers.get("authorization");
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const rawBody = await request.json().catch(() => undefined);
  const { status, body } = await updateUserHandler(authorizationHeader, query, userId, rawBody);
  return NextResponse.json(body, { status });
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const { userId } = await context.params;
  const authorizationHeader = request.headers.get("authorization");
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const { status, body } = await removeUserHandler(authorizationHeader, query, userId);
  return NextResponse.json(body, { status });
}
