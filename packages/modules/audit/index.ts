// Public surface of the audit module. Internal folders (domain,
// infrastructure) remain private — see Architecture.md "Module Communication".

import type { Transaction } from "@allinvites/database";
import type { Result } from "@allinvites/kernel";
import {
  createRecordAuditEventService,
  type RecordAuditEventError,
  type RecordAuditEventService,
} from "./application/services/record-audit-event.service";
import type { AuditEvent } from "./domain/entities/audit-event";
import { DrizzleAuditLogRepository } from "./infrastructure/repositories/drizzle-audit-log-repository";

export {
  createRecordAuditEventService,
  type RecordAuditEventError,
  type RecordAuditEventService,
} from "./application/services/record-audit-event.service";
export type { AuditEvent } from "./domain/entities/audit-event";

let cachedRecordAuditEvent: RecordAuditEventService | undefined;

/**
 * Ready-to-use, pre-wired `RecordAuditEventService` (STORY-003-004). Appends
 * one immutable record within the caller's transaction. Instantiates
 * infrastructure lazily, on first call, never at import time.
 */
export function recordAuditEvent(
  event: AuditEvent,
  tx: Transaction,
): Promise<Result<void, RecordAuditEventError>> {
  if (!cachedRecordAuditEvent) {
    cachedRecordAuditEvent = createRecordAuditEventService(new DrizzleAuditLogRepository());
  }
  return cachedRecordAuditEvent(event, tx);
}
