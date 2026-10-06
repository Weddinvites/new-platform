import type { Transaction } from "@allinvites/database";
import type { Result } from "@allinvites/kernel";

/**
 * ADR-007 audit record for a critical action. Declared locally (structural
 * copy of the Audit module's public `AuditEvent`) so Organizations does not
 * gain a package dependency until the Audit module is wired.
 */
export type AuditRecord = {
  readonly userId: string;
  readonly organizationId: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly result: "SUCCESS" | "FAILURE";
  readonly metadata?: Record<string, unknown>;
};

export type AuditRecorder = (
  record: AuditRecord,
  tx: Transaction,
) => Promise<Result<void, { readonly type: "UNEXPECTED"; readonly cause: unknown }>>;
