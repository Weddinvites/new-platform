import type { Transaction } from "@allinvites/database";
import type { AuditEvent } from "../entities/audit-event";

/**
 * Append-only port (ADR-007). There is deliberately no update or delete
 * operation: the database rejects both for this table.
 */
export interface AuditLogRepository {
  append(event: AuditEvent, tx: Transaction): Promise<void>;
}
