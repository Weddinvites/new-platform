import { err, ok, type Result } from "@allinvites/kernel";
import type {
  RetrieveSubscriptionSummaryError,
  RetrieveSubscriptionSummaryService,
  SubscriptionSummary,
} from "@allinvites/module-billing";
import type {
  VerifyActiveMembershipError,
  VerifyActiveMembershipService,
} from "@allinvites/module-identity";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  SessionVerifier,
  SessionVerifierError,
  VerifiedCaller,
} from "../../application/ports/session-verifier";
import { RetrieveSubscriptionUseCase } from "../../application/use-cases/retrieve-subscription.use-case";
import { createRetrieveSubscriptionHandler } from "./retrieve-subscription.handler";

const CALLER_ID = "11111111-1111-1111-1111-111111111111";
const ORGANIZATION_ID = "22222222-2222-4222-8222-222222222222";

const SUMMARY: SubscriptionSummary = {
  id: "sub-1",
  organizationId: ORGANIZATION_ID,
  plan: "EMPRENDEDOR",
  status: "TRIAL",
  trialEndsAt: new Date("2026-02-01T00:00:00.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

class FakeSessionVerifier implements SessionVerifier {
  result: Result<VerifiedCaller, SessionVerifierError> = ok({ userId: CALLER_ID });

  async verify(): Promise<Result<VerifiedCaller, SessionVerifierError>> {
    return this.result;
  }
}

function fakeVerifyActiveMembership(
  result: Result<void, VerifyActiveMembershipError>,
): VerifyActiveMembershipService {
  return async () => result;
}

function fakeRetrieveSubscriptionSummary(
  result: Result<SubscriptionSummary, RetrieveSubscriptionSummaryError> = ok(SUMMARY),
): RetrieveSubscriptionSummaryService {
  return async () => result;
}

describe("retrieveSubscriptionHandler", () => {
  let sessionVerifier: FakeSessionVerifier;

  beforeEach(() => {
    sessionVerifier = new FakeSessionVerifier();
  });

  function buildHandler(
    verifyActiveMembership: VerifyActiveMembershipService,
    retrieveSubscriptionSummary: RetrieveSubscriptionSummaryService = fakeRetrieveSubscriptionSummary(),
  ) {
    const useCase = new RetrieveSubscriptionUseCase(
      verifyActiveMembership,
      retrieveSubscriptionSummary,
      sessionVerifier,
    );
    return createRetrieveSubscriptionHandler(useCase);
  }

  it("returns 200 with the Subscription on success", async () => {
    const handler = buildHandler(fakeVerifyActiveMembership(ok(undefined)));

    const response = await handler("Bearer a-valid-access-token", {
      organizationId: ORGANIZATION_ID,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        organization_id: ORGANIZATION_ID,
        plan: "EMPRENDEDOR",
        status: "TRIAL",
        trial_ends_at: "2026-02-01T00:00:00.000Z",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    });
  });

  it("stays reachable and reports the effective PAST_DUE status — it's how an account sees it must pay", async () => {
    const handler = buildHandler(
      fakeVerifyActiveMembership(ok(undefined)),
      fakeRetrieveSubscriptionSummary(ok({ ...SUMMARY, status: "PAST_DUE" })),
    );

    const response = await handler("Bearer a-valid-access-token", {
      organizationId: ORGANIZATION_ID,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, data: { status: "PAST_DUE" } });
  });

  it("returns 401 UNAUTHORIZED when no Authorization header is present", async () => {
    const handler = buildHandler(fakeVerifyActiveMembership(ok(undefined)));

    const response = await handler(null, { organizationId: ORGANIZATION_ID });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ success: false, error: { code: "UNAUTHORIZED" } });
  });

  it("returns 401 UNAUTHORIZED when the access token is invalid or expired", async () => {
    sessionVerifier.result = err({ type: "UNAUTHORIZED" });
    const handler = buildHandler(fakeVerifyActiveMembership(ok(undefined)));

    const response = await handler("Bearer an-expired-token", { organizationId: ORGANIZATION_ID });

    expect(response.status).toBe(401);
  });

  it("returns 422 VALIDATION_ERROR for a malformed organizationId", async () => {
    const handler = buildHandler(fakeVerifyActiveMembership(ok(undefined)));

    const response = await handler("Bearer a-valid-access-token", { organizationId: "not-a-uuid" });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("returns byte-identical 404 responses for a nonexistent organization and an inaccessible one", async () => {
    const handlerForNonexistent = buildHandler(
      fakeVerifyActiveMembership(err({ type: "NOT_A_MEMBER" })),
      fakeRetrieveSubscriptionSummary(err({ type: "NOT_FOUND" })),
    );
    const responseForNonexistent = await handlerForNonexistent("Bearer a-valid-access-token", {
      organizationId: ORGANIZATION_ID,
    });

    const handlerForInaccessible = buildHandler(
      fakeVerifyActiveMembership(err({ type: "NOT_A_MEMBER" })),
    );
    const responseForInaccessible = await handlerForInaccessible("Bearer a-valid-access-token", {
      organizationId: ORGANIZATION_ID,
    });

    expect(responseForNonexistent.status).toBe(404);
    expect(responseForInaccessible.status).toBe(404);
    expect(JSON.stringify(responseForNonexistent.body)).toBe(
      JSON.stringify(responseForInaccessible.body),
    );
  });

  it("returns 500 without leaking details on an unexpected failure", async () => {
    const handler = buildHandler(
      fakeVerifyActiveMembership(err({ type: "UNEXPECTED", cause: new Error("db down") })),
    );

    const response = await handler("Bearer a-valid-access-token", {
      organizationId: ORGANIZATION_ID,
    });

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR" },
    });
    expect(JSON.stringify(response.body)).not.toContain("db down");
  });
});
