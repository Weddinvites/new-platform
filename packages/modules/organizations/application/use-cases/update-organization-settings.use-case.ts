import { err, ok, type Result } from "@allinvites/kernel";
import type { VerifyOwnerMembershipService } from "@allinvites/module-identity";
import type { Organization } from "../../domain/entities/organization";
import type { OrganizationRepository } from "../../domain/repositories/organization-repository";
import type { UpdateOrganizationSettingsCommand } from "../commands/update-organization-settings.command";
import type { SessionVerifier } from "../ports/session-verifier";

export type UpdateOrganizationSettingsError =
  | { readonly type: "UNAUTHORIZED" }
  | { readonly type: "NOT_FOUND" }
  | { readonly type: "FORBIDDEN" }
  | { readonly type: "ORGANIZATION_SUSPENDED" }
  | { readonly type: "UNEXPECTED"; readonly cause: unknown };

export type UpdateOrganizationSettingsResult = {
  readonly organization: Organization;
};

/**
 * STORY-003-006 — Update Organization Settings (EPIC_003_ORGANIZATIONS.md
 * §5). Authorization, tenancy, and SYSTEM-organization handling are
 * identical to STORY-003-003/005. `support_contact_email` is the sole
 * approved field — required, not clearable: unlike STORY-003-005's
 * partial-update branding fields, this command always carries a value to
 * persist.
 */
export class UpdateOrganizationSettingsUseCase {
  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly verifyOwnerMembership: VerifyOwnerMembershipService,
    private readonly sessionVerifier: SessionVerifier,
  ) {}

  async execute(
    accessToken: string,
    command: UpdateOrganizationSettingsCommand,
  ): Promise<Result<UpdateOrganizationSettingsResult, UpdateOrganizationSettingsError>> {
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

    const updated = await this.organizationRepository.updateSettings(command.organizationId, {
      supportContactEmail: command.supportContactEmail,
    });

    return ok({ organization: updated });
  }
}
