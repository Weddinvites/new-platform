import type { Transaction } from "@allinvites/database";
import { err, ok, type Result } from "@allinvites/kernel";
import type { AuditEvent } from "../../domain/entities/audit-event";
import type { AuditLogRepository } from "../../domain/repositories/audit-log-repository";

export type RecordAuditEventError = { readonly type: "UNEXPECTED"; readonly cause: unknown };

export type RecordAuditEventService = (
  event: AuditEvent,
  tx: Transaction,
) => Promise<Result<void, RecordAuditEventError>>;

/**
 * ADR-007 "Audit Trail": records a critical action. Must be called with the
 * transaction of the change it describes, so the record and the change are
 * atomic. Returns a Result instead of throwing so the caller decides how to
 * roll back.
 */
export function createRecordAuditEventService(
  auditLogRepository: AuditLogRepository,
): RecordAuditEventService {
  return async function recordAuditEvent(event, tx) {
    try {
      await auditLogRepository.append(event, tx);
      return ok(undefined);
    } catch (error) {
      return err({ type: "UNEXPECTED", cause: error });
    }
  };
}
