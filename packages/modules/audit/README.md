# @allinvites/module-audit

Immutable audit log of platform actions (ADR-007 "Audit Trail").

Public surface: `recordAuditEvent(event, tx)`. It appends one record inside
the caller's transaction, so the record commits or rolls back with the change
it describes. There is no update or delete operation. The database
(`supabase/migrations/20261006120100_audit_logs.sql`) rejects both.

Currently used by Organizations for administrative status changes (STORY-003-004).
