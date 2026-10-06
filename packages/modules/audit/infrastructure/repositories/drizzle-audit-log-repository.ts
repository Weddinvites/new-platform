import { schema, type Transaction } from "@allinvites/database";
import type { AuditEvent } from "../../domain/entities/audit-event";
import type { AuditLogRepository } from "../../domain/repositories/audit-log-repository";

/**
 * Drizzle-backed append-only implementation. Writes within the caller's
 * transaction so an audit record commits or rolls back together with the
 * change it describes.
 */
export class DrizzleAuditLogRepository implements AuditLogRepository {
  async append(event: AuditEvent, tx: Transaction): Promise<void> {
    await tx.insert(schema.auditLogs).values({
      userId: event.userId,
      organizationId: event.organizationId,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      result: event.result,
      metadata: event.metadata ?? null,
    });
  }
}
