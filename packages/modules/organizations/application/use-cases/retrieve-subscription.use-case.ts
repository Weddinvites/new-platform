import { err, ok, type Result } from "@allinvites/kernel";
import type {
  RetrieveSubscriptionSummaryService,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@allinvites/module-billing";
import type { VerifyActiveMembershipService } from "@allinvites/module-identity";
import type { PlatformPrivilegeVerifier } from "../ports/platform-privilege-verifier";
import type { SessionVerifier } from "../ports/session-verifier";

export type RetrieveSubscriptionError =
  | { readonly type: "UNAUTHORIZED" }
  | { readonly type: "NOT_FOUND" }
  | { readonly type: "UNEXPECTED"; readonly cause: unknown };

export type RetrieveSubscriptionResult = {
  readonly organizationId: string;
  readonly plan: SubscriptionPlan;
  readonly status: SubscriptionStatus;
  readonly trialEndsAt: Date | null;
  readonly createdAt: Date;
};

/**
 * STORY-004-001 — Retrieve Subscription. Any ACTIVE member (any role) may
 * call it — deliberately not OWNER-only, so a non-Owner isn't locked out of
 * seeing a Past Due status — or a platform-privileged caller (STORY-003-004),
 * for any Organization. Deliberately stays reachable even when the
 * Subscription is Past Due — it's how an account sees it's blocked and
 * knows to pay.
 *
 * A nonexistent organization, an inaccessible one, and a SYSTEM organization
 * (which never has a Subscription — only Create Organization creates one,
 * and it only ever creates PARTNER organizations) all collapse to the same
 * NOT_FOUND: Billing's own RetrieveSubscriptionSummaryService returns
 * NOT_FOUND whenever no Subscription row exists, which doubles as the final
 * existence check — no separate OrganizationRepository lookup is needed
 * here, since every PARTNER Organization always has exactly one Subscription
 * (created atomically alongside it).
 */
export class RetrieveSubscriptionUseCase {
  constructor(
    private readonly verifyActiveMembership: VerifyActiveMembershipService,
    private readonly retrieveSubscriptionSummary: RetrieveSubscriptionSummaryService,
    private readonly sessionVerifier: SessionVerifier,
    private readonly isPlatformPrivileged: PlatformPrivilegeVerifier = async () => false,
  ) {}

  async execute(
    accessToken: string,
    organizationId: string,
  ): Promise<Result<RetrieveSubscriptionResult, RetrieveSubscriptionError>> {
    const caller = await this.sessionVerifier.verify(accessToken);
    if (!caller.ok) {
      if (caller.error.type === "UNAUTHORIZED") {
        return err({ type: "UNAUTHORIZED" });
      }
      return err({ type: "UNEXPECTED", cause: caller.error.cause });
    }

    const membershipCheck = await this.verifyActiveMembership({
      userId: caller.value.userId,
      organizationId,
    });

    if (!membershipCheck.ok) {
      if (membershipCheck.error.type !== "NOT_A_MEMBER") {
        return err({ type: "UNEXPECTED", cause: membershipCheck.error.cause });
      }

      let privileged: boolean;
      try {
        privileged = await this.isPlatformPrivileged({ userId: caller.value.userId });
      } catch (error) {
        return err({ type: "UNEXPECTED", cause: error });
      }
      if (!privileged) {
        return err({ type: "NOT_FOUND" });
      }
    }

    const summary = await this.retrieveSubscriptionSummary({ organizationId });
    if (!summary.ok) {
      if (summary.error.type === "NOT_FOUND") {
        return err({ type: "NOT_FOUND" });
      }
      return err({ type: "UNEXPECTED", cause: summary.error.cause });
    }

    return ok({
      organizationId,
      plan: summary.value.plan,
      status: summary.value.status,
      trialEndsAt: summary.value.trialEndsAt,
      createdAt: summary.value.createdAt,
    });
  }
}
