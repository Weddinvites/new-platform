import { err, ok, type Result } from "@allinvites/kernel";
import type { VerifyOwnerMembershipService } from "@allinvites/module-identity";
import type { Organization } from "../../domain/entities/organization";
import type { OrganizationRepository } from "../../domain/repositories/organization-repository";
import type { UpdateOrganizationBrandingCommand } from "../commands/update-organization-branding.command";
import type { SessionVerifier } from "../ports/session-verifier";

export type UpdateOrganizationBrandingError =
  | { readonly type: "UNAUTHORIZED" }
  | { readonly type: "NOT_FOUND" }
  | { readonly type: "FORBIDDEN" }
  | { readonly type: "ORGANIZATION_SUSPENDED" }
  | { readonly type: "UNEXPECTED"; readonly cause: unknown };

export type UpdateOrganizationBrandingResult = {
  readonly organization: Organization;
};

/**
 * STORY-003-005 — Update Organization Branding (EPIC_003_ORGANIZATIONS.md
 * §5). Authorization, tenancy, and SYSTEM-organization handling are
 * identical to STORY-003-003's Update Organization. Only the fields present
 * on `command` are persisted — `brand_name`, `logo`, `primary_color`, and
 * `secondary_color` are all independently optional; the handler layer is
 * responsible for rejecting a request with none of them set (Validation and
 * Test Requirements, EPIC_003_ORGANIZATIONS.md). Custom Domain is never
 * part of this contract — it remains exclusively Invitation Deployment's
 * concern.
 */
export class UpdateOrganizationBrandingUseCase {
  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly verifyOwnerMembership: VerifyOwnerMembershipService,
    private readonly sessionVerifier: SessionVerifier,
  ) {}

  async execute(
    accessToken: string,
    command: UpdateOrganizationBrandingCommand,
  ): Promise<Result<UpdateOrganizationBrandingResult, UpdateOrganizationBrandingError>> {
    const caller = await this.sessionVerifier.verify(accessToken);
    if (!caller.ok) {
      if (caller.error.type === "UNAUTHORIZED") {
        return err({ type: "UNAUTHORIZED" });
      }
      return err({ type: "UNEXPECTED", cause: caller.error.cause });
    }

    const ownerCheck = await this.verifyOwnerMembership({
      userId: caller.value.userId,
      organizationId: command.organizationId,
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

    const organization = await this.organizationRepository.findById(command.organizationId);
    if (!organization) {
      return err({ type: "NOT_FOUND" });
    }

    if (organization.organizationType === "SYSTEM") {
      return err({ type: "NOT_FOUND" });
    }

    if (organization.isSuspended()) {
      return err({ type: "ORGANIZATION_SUSPENDED" });
    }

    const changes: Partial<{
      brandName: string;
      logo: string;
      primaryColor: string;
      secondaryColor: string;
    }> = {};
    if (command.brandName !== undefined) changes.brandName = command.brandName;
    if (command.logo !== undefined) changes.logo = command.logo;
    if (command.primaryColor !== undefined) changes.primaryColor = command.primaryColor;
    if (command.secondaryColor !== undefined) changes.secondaryColor = command.secondaryColor;

    const updated = await this.organizationRepository.updateBranding(
      command.organizationId,
      changes,
    );

    return ok({ organization: updated });
  }
}
