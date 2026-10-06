import { type Database, getDatabase, type Transaction } from "@allinvites/database";
import { err, ok, type Result } from "@allinvites/kernel";
import type { VerifyActiveMembershipService } from "@allinvites/module-identity";
import type { Organization, OrganizationStatus } from "../../domain/entities/organization";
import type { OrganizationStatusRepository } from "../../domain/repositories/organization-status-repository";
import type { SetOrganizationStatusCommand } from "../commands/set-organization-status.command";
import type { AuditRecorder } from "../ports/audit-recorder";
import type { PlatformPrivilegeVerifier } from "../ports/platform-privilege-verifier";
import type { SessionVerifier } from "../ports/session-verifier";

export type SetOrganizationStatusError =
  | { readonly type: "UNAUTHORIZED" }
  | { readonly type: "NOT_FOUND" }
  | { readonly type: "FORBIDDEN" }
  | { readonly type: "UNEXPECTED"; readonly cause: unknown };

export type SetOrganizationStatusResult = {
  readonly organization: Organization;
  /** false when the organization already had the requested status (idempotent no-op, no write, no audit record). */
  readonly changed: boolean;
};

const AUDIT_ACTION: Record<OrganizationStatus, string> = {
  SUSPENDED: "ORGANIZATION_SUSPENDED",
  ACTIVE: "ORGANIZATION_ACTIVATED",
};

/**
 * A lost race is re-read and decided again. Two attempts are enough: the
 * second read reflects whatever the winning request committed, and only a
 * third concurrent change inside that window would exhaust them.
 */
const MAX_TRANSITION_ATTEMPTS = 2;

/**
 * STORY-003-004 — Activate / Suspend Organization (API_SPEC.md §22).
 *
 * Authorization: platform privilege only, never target-organization
 * membership. A non-privileged caller with no ACTIVE membership in the target
 * gets NOT_FOUND; a non-privileged ACTIVE member gets FORBIDDEN. Both checks
 * use the same concealment rule as the rest of the module.
 *
 * SYSTEM-typed organizations are normalized to NOT_FOUND. A real transition is
 * a conditional update (`WHERE organization_status = <the value just read>`)
 * in the same transaction as its audit record. If a concurrent request
 * changed the status first, zero rows match, and the use case re-reads
 * instead of writing over that change. So exactly one audit record exists per
 * actual change, and its `previousStatus` is the value that was really
 * replaced. Same-state requests are idempotent: they return the current state
 * with no write and no audit record.
 */
export class SetOrganizationStatusUseCase {
  constructor(
    private readonly organizationStatusRepository: OrganizationStatusRepository,
    private readonly verifyPlatformPrivilege: PlatformPrivilegeVerifier,
    private readonly verifyActiveMembership: VerifyActiveMembershipService,
    private readonly recordAuditEvent: AuditRecorder,
    private readonly sessionVerifier: SessionVerifier,
    private readonly db: Database = getDatabase(),
  ) {}

  async execute(
    accessToken: string,
    command: SetOrganizationStatusCommand,
  ): Promise<Result<SetOrganizationStatusResult, SetOrganizationStatusError>> {
    const caller = await this.sessionVerifier.verify(accessToken);
    if (!caller.ok) {
      if (caller.error.type === "UNAUTHORIZED") {
        return err({ type: "UNAUTHORIZED" });
      }
      return err({ type: "UNEXPECTED", cause: caller.error.cause });
    }

    const userId = caller.value.userId;

    let privileged: boolean;
    try {
      privileged = await this.verifyPlatformPrivilege({ userId });
    } catch (error) {
      return err({ type: "UNEXPECTED", cause: error });
    }

    if (!privileged) {
      const membership = await this.verifyActiveMembership({
        userId,
        organizationId: command.organizationId,
      });
      if (!membership.ok) {
        if (membership.error.type === "NOT_A_MEMBER") {
          return err({ type: "NOT_FOUND" });
        }
        return err({ type: "UNEXPECTED", cause: membership.error.cause });
      }
      return err({ type: "FORBIDDEN" });
    }

    for (let attempt = 1; attempt <= MAX_TRANSITION_ATTEMPTS; attempt += 1) {
      const organization = await this.organizationStatusRepository.findById(command.organizationId);
      if (!organization) {
        return err({ type: "NOT_FOUND" });
      }

      if (organization.organizationType === "SYSTEM") {
        return err({ type: "NOT_FOUND" });
      }

      if (organization.organizationStatus === command.status) {
        return ok({ organization, changed: false });
      }

      let transitioned: Organization | null;
      try {
        transitioned = await this.transition(organization, command.status, userId);
      } catch (error) {
        return err({ type: "UNEXPECTED", cause: error });
      }

      if (transitioned) {
        return ok({ organization: transitioned, changed: true });
      }
      // Zero rows matched: a concurrent request changed the status after this
      // read. Loop to re-read the current state and decide again.
    }

    return err({
      type: "UNEXPECTED",
      cause: new Error("Organization status changed concurrently on every attempt."),
    });
  }

  /**
   * Returns the updated organization, or null when the conditional update
   * matched no row (a concurrent change). Throws on infrastructure failure,
   * including a failed audit write, which rolls back the status change.
   */
  private transition(
    organization: Organization,
    to: OrganizationStatus,
    userId: string,
  ): Promise<Organization | null> {
    return this.db.transaction(async (tx: Transaction) => {
      const updated = await this.organizationStatusRepository.updateStatus(
        organization.id,
        organization.organizationStatus,
        to,
        tx,
      );
      if (!updated) {
        return null;
      }

      const audit = await this.recordAuditEvent(
        {
          userId,
          organizationId: organization.id,
          action: AUDIT_ACTION[to],
          resourceType: "ORGANIZATION",
          resourceId: organization.id,
          result: "SUCCESS",
          metadata: {
            previousStatus: organization.organizationStatus,
            newStatus: to,
          },
        },
        tx,
      );
      if (!audit.ok) {
        throw new Error("Audit record could not be written.", { cause: audit.error.cause });
      }

      return updated;
    });
  }
}
