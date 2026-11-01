import { err, ok, type Result } from "@allinvites/kernel";
import type {
  RetrieveSubscriptionSummaryError,
  RetrieveSubscriptionSummaryService,
  SubscriptionSummary,
} from "@allinvites/module-billing";
import type { VerifyActiveMembershipService } from "@allinvites/module-identity";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  SessionVerifier,
  SessionVerifierError,
  VerifiedCaller,
} from "../ports/session-verifier";
import { RetrieveSubscriptionUseCase } from "./retrieve-subscription.use-case";

const CALLER_ID = "11111111-1111-1111-1111-111111111111";
const ORGANIZATION_ID = "22222222-2222-2222-2222-222222222222";

const SUMMARY: SubscriptionSummary = {
  id: "sub-1",
  organizationId: ORGANIZATION_ID,
  plan: "PLANNER_ESENCIAL",
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

function fakeRetrieveSubscriptionSummary(
  result: Result<SubscriptionSummary, RetrieveSubscriptionSummaryError> = ok(SUMMARY),
): { service: RetrieveSubscriptionSummaryService; calls: { organizationId: string }[] } {
  const calls: { organizationId: string }[] = [];
  const service: RetrieveSubscriptionSummaryService = async (params) => {
    calls.push(params);
    return result;
  };
  return { service, calls };
}

const activeMember: VerifyActiveMembershipService = async () => ok(undefined);
const notAMember: VerifyActiveMembershipService = async () => err({ type: "NOT_A_MEMBER" });

describe("RetrieveSubscriptionUseCase", () => {
  let sessionVerifier: FakeSessionVerifier;

  beforeEach(() => {
    sessionVerifier = new FakeSessionVerifier();
  });

  it("returns the Subscription summary for an ACTIVE member (any role)", async () => {
    const { service, calls } = fakeRetrieveSubscriptionSummary();
    const useCase = new RetrieveSubscriptionUseCase(activeMember, service, sessionVerifier);

    const result = await useCase.execute("token", ORGANIZATION_ID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      organizationId: ORGANIZATION_ID,
      plan: "PLANNER_ESENCIAL",
      status: "TRIAL",
      trialEndsAt: SUMMARY.trialEndsAt,
      createdAt: SUMMARY.createdAt,
    });
    expect(calls).toEqual([{ organizationId: ORGANIZATION_ID }]);
  });

  it("surfaces the effective PAST_DUE status when Billing reports it", async () => {
    const { service } = fakeRetrieveSubscriptionSummary(ok({ ...SUMMARY, status: "PAST_DUE" }));
    const useCase = new RetrieveSubscriptionUseCase(activeMember, service, sessionVerifier);

    const result = await useCase.execute("token", ORGANIZATION_ID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("PAST_DUE");
  });

  it("returns NOT_FOUND when the caller has no ACTIVE membership and is not platform-privileged", async () => {
    const { service, calls } = fakeRetrieveSubscriptionSummary();
    const useCase = new RetrieveSubscriptionUseCase(
      notAMember,
      service,
      sessionVerifier,
      async () => false,
    );

    const result = await useCase.execute("token", ORGANIZATION_ID);

    expect(result).toEqual(err({ type: "NOT_FOUND" }));
    expect(calls).toHaveLength(0);
  });

  it("lets a platform-privileged non-member retrieve the Subscription", async () => {
    const { service } = fakeRetrieveSubscriptionSummary();
    const useCase = new RetrieveSubscriptionUseCase(
      notAMember,
      service,
      sessionVerifier,
      async () => true,
    );

    const result = await useCase.execute("token", ORGANIZATION_ID);

    expect(result.ok).toBe(true);
  });

  it("returns NOT_FOUND when no Subscription row exists (nonexistent organization, or a SYSTEM organization, which never has one)", async () => {
    const { service } = fakeRetrieveSubscriptionSummary(err({ type: "NOT_FOUND" }));
    const useCase = new RetrieveSubscriptionUseCase(activeMember, service, sessionVerifier);

    const result = await useCase.execute("token", ORGANIZATION_ID);

    expect(result).toEqual(err({ type: "NOT_FOUND" }));
  });

  it("rejects an unauthenticated caller without checking membership", async () => {
    sessionVerifier.result = err({ type: "UNAUTHORIZED" });
    const { service, calls } = fakeRetrieveSubscriptionSummary();
    const useCase = new RetrieveSubscriptionUseCase(activeMember, service, sessionVerifier);

    const result = await useCase.execute("bad-token", ORGANIZATION_ID);

    expect(result).toEqual(err({ type: "UNAUTHORIZED" }));
    expect(calls).toHaveLength(0);
  });

  it("propagates an unexpected membership-verification failure", async () => {
    const membership: VerifyActiveMembershipService = async () =>
      err({ type: "UNEXPECTED", cause: new Error("db down") });
    const { service } = fakeRetrieveSubscriptionSummary();
    const useCase = new RetrieveSubscriptionUseCase(membership, service, sessionVerifier);

    const result = await useCase.execute("token", ORGANIZATION_ID);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });

  it("returns UNEXPECTED when the platform-privilege check throws", async () => {
    const { service } = fakeRetrieveSubscriptionSummary();
    const useCase = new RetrieveSubscriptionUseCase(
      notAMember,
      service,
      sessionVerifier,
      async () => {
        throw new Error("db down");
      },
    );

    const result = await useCase.execute("token", ORGANIZATION_ID);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });

  it("propagates an unexpected failure from Billing's summary lookup", async () => {
    const { service } = fakeRetrieveSubscriptionSummary(
      err({ type: "UNEXPECTED", cause: new Error("subscriptions table unavailable") }),
    );
    const useCase = new RetrieveSubscriptionUseCase(activeMember, service, sessionVerifier);

    const result = await useCase.execute("token", ORGANIZATION_ID);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });
});
