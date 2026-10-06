import { err, ok, type Result } from "@allinvites/kernel";
import type { VerifyActiveMembershipService } from "@allinvites/module-identity";
import type { Organization } from "../../domain/entities/organization";
import type { OrganizationRepository } from "../../domain/repositories/organization-repository";
import type { SessionVerifier } from "../ports/session-verifier";

export type RetrieveOrganizationError =
  | { readonly type: "UNAUTHORIZED" }
  | { readonly type: "NOT_FOUND" }
  | { readonly type: "UNEXPECTED"; readonly cause: unknown };

export type RetrieveOrganizationResult = {
  readonly organization: Organization;
};

/**
 * STORY-003-002 — Retrieve Organization (EPIC_003_ORGANIZATIONS.md §5).
 * Authorization is delegated to Identity's `verifyActiveMembership`
 * (ADR-011: Organizations never touches OrganizationMembership internals or
 * the organization_memberships table directly). A nonexistent
 * `organizationId` and an existing one the caller has no ACTIVE membership
 * in both collapse to the same `NOT_FOUND` — the membership check alone
 * already returns NOT_A_MEMBER for a nonexistent organization id (no
 * membership row can reference it), so `findById` is only ever reached once
 * access is already confirmed.
 */
export class RetrieveOrganizationUseCase {
  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly verifyActiveMembership: VerifyActiveMembershipService,
    private readonly sessionVerifier: SessionVerifier,
  ) {}

  async execute(
    accessToken: string,
    organizationId: string,
  ): Promise<Result<RetrieveOrganizationResult, RetrieveOrganizationError>> {
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
      if (membershipCheck.error.type === "NOT_A_MEMBER") {
        return err({ type: "NOT_FOUND" });
      }
      return err({ type: "UNEXPECTED", cause: membershipCheck.error.cause });
    }

    const organization = await this.organizationRepository.findById(organizationId);
    if (!organization) {
      return err({ type: "NOT_FOUND" });
    }

    return ok({ organization });
  }
}
