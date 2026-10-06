import { err, ok, type Result } from "@allinvites/kernel";
import { describe, expect, it } from "vitest";
import type {
  SetOrganizationStatusError,
  SetOrganizationStatusResult,
  SetOrganizationStatusUseCase,
} from "../../application/use-cases/set-organization-status.use-case";
import { Organization } from "../../domain/entities/organization";
import { Slug } from "../../domain/value-objects/slug";
import { createSetOrganizationStatusHandler } from "./set-organization-status.handler";

const ORGANIZATION_ID = "22222222-2222-4222-8222-222222222222";

function useCaseReturning(
  result: Result<SetOrganizationStatusResult, SetOrganizationStatusError>,
): { useCase: SetOrganizationStatusUseCase; calls: unknown[] } {
  const calls: unknown[] = [];
  const useCase = {
    async execute(token: string, command: unknown) {
      calls.push({ token, command });
      return result;
    },
  } as unknown as SetOrganizationStatusUseCase;
  return { useCase, calls };
}

function organization(status: "ACTIVE" | "SUSPENDED"): Organization {
  return Organization.fromPersistence({
    id: ORGANIZATION_ID,
    organizationType: "PARTNER",
    slug: Slug.fromPersistence("acme"),
    displayName: "Acme",
    createdAt: new Date(),
    organizationStatus: status,
  });
}

describe("setOrganizationStatusHandler (STORY-003-004)", () => {
  it("returns 200 with the resulting status and sends the fixed target status to the use case", async () => {
    const { useCase, calls } = useCaseReturning(
      ok({ organization: organization("SUSPENDED"), changed: true }),
    );
    const handler = createSetOrganizationStatusHandler(useCase, "SUSPENDED");

    const response = await handler("Bearer token", { organizationId: ORGANIZATION_ID });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { id: ORGANIZATION_ID, organization_status: "SUSPENDED" },
    });
    expect(calls).toEqual([
      { token: "token", command: { organizationId: ORGANIZATION_ID, status: "SUSPENDED" } },
    ]);
  });

  it("returns 401 UNAUTHORIZED without a bearer token", async () => {
    const { useCase, calls } = useCaseReturning(
      ok({ organization: organization("ACTIVE"), changed: false }),
    );
    const handler = createSetOrganizationStatusHandler(useCase, "ACTIVE");

    const response = await handler(null, { organizationId: ORGANIZATION_ID });

    expect(response.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it("returns 422 VALIDATION_ERROR for a malformed organizationId", async () => {
    const { useCase, calls } = useCaseReturning(
      ok({ organization: organization("ACTIVE"), changed: false }),
    );
    const handler = createSetOrganizationStatusHandler(useCase, "ACTIVE");

    const response = await handler("Bearer token", { organizationId: "not-a-uuid" });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
    expect(calls).toHaveLength(0);
  });

  it("returns 404 RESOURCE_NOT_FOUND for NOT_FOUND", async () => {
    const { useCase } = useCaseReturning(err({ type: "NOT_FOUND" }));
    const handler = createSetOrganizationStatusHandler(useCase, "ACTIVE");

    const response = await handler("Bearer token", { organizationId: ORGANIZATION_ID });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ error: { code: "RESOURCE_NOT_FOUND" } });
  });

  it("returns 403 FORBIDDEN for a non-platform-privileged member", async () => {
    const { useCase } = useCaseReturning(err({ type: "FORBIDDEN" }));
    const handler = createSetOrganizationStatusHandler(useCase, "SUSPENDED");

    const response = await handler("Bearer token", { organizationId: ORGANIZATION_ID });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ error: { code: "FORBIDDEN" } });
  });

  it("returns 500 without leaking the internal cause", async () => {
    const { useCase } = useCaseReturning(
      err({ type: "UNEXPECTED", cause: new Error("connection reset") }),
    );
    const handler = createSetOrganizationStatusHandler(useCase, "SUSPENDED");

    const response = await handler("Bearer token", { organizationId: ORGANIZATION_ID });

    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain("connection reset");
  });
});
