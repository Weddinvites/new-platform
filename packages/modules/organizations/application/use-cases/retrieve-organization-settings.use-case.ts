import { err, ok, type Result } from "@allinvites/kernel";
import type { VerifyOwnerMembershipService } from "@allinvites/module-identity";
import type { Organization } from "../../domain/entities/organization";
import type { OrganizationRepository } from "../../domain/repositories/organization-repository";
import type { SessionVerifier } from "../ports/session-verifier";

export type RetrieveOrganizationSettingsError =
  | { readonly type: "UNAUTHORIZED" }
  | { readonly type: "NOT_FOUND" }
  | { readonly type: "FORBIDDEN" }
  | { readonly type: "UNEXPECTED"; readonly cause: unknown };

export type RetrieveOrganizationSettingsResult = {
  readonly organization: Organization;
};

/**
 * STORY-003-006 — Retrieve Organization Settings (EPIC_003_ORGANIZATIONS.md
 * §5). Authorization mirrors STORY-003-003/005 exactly: `verifyOwnerMembership`
 * first (ADR-011: Organizations never touches OrganizationMembership
 * internals or the organization_memberships table directly), then the
 * organization is fetched, then a SYSTEM-typed organization is normalized
 * to the same `NOT_FOUND` as an inaccessible one — defense-in-depth, since
 * no flow in this codebase ever creates a documented OWNER membership in
 * the SYSTEM organization.
 */
export class RetrieveOrganizationSettingsUseCase {
  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly verifyOwnerMembership: VerifyOwnerMembershipService,
    private readonly sessionVerifier: SessionVerifier,
  ) {}

  async execute(
    accessToken: string,
    organizationId: string,
  ): Promise<Result<RetrieveOrganizationSettingsResult, RetrieveOrganizationSettingsError>> {
    const caller = await this.sessionVerifier.verify(accessToken);
    if (!caller.ok) {
      if (caller.error.type === "UNAUTHORIZED") {
        return err({ type: "UNAUTHORIZED" });
      }
      return err({ type: "UNEXPECTED", cause: caller.error.cause });
    }

    const ownerCheck = await this.verifyOwnerMembership({
      userId: caller.value.userId,
      organizationId,
    });

    if (!ownerCheck.ok) {
      if (ownerCheck.error.type === "NOT_ACTIVE_MEMBER") {
        return err({ type: "NOT_FOUND" });
      }
      if (ownerCheck.error.type === "NOT_OWNER") {
        return err({ type: "FORBIDDEN" });
      }
      return err({ type: "UNEXPECTED", cause: ownerCheck.error.cause });
    }

    const organization = await this.organizationRepository.findById(organizationId);
    if (!organization) {
      return err({ type: "NOT_FOUND" });
    }

    if (organization.organizationType === "SYSTEM") {
      return err({ type: "NOT_FOUND" });
    }

    return ok({ organization });
  }
}
