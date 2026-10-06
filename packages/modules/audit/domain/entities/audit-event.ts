/**
 * An immutable record of a critical platform action (ADR-007 "Audit Trail").
 * Created once and appended; never updated or deleted by the application.
 */
export type AuditEvent = {
  readonly userId: string;
  readonly organizationId: string;
  /** Stable, uppercase action name, e.g. "ORGANIZATION_SUSPENDED". */
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly result: "SUCCESS" | "FAILURE";
  readonly metadata?: Record<string, unknown>;
};
