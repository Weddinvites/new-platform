-- Audit: STORY-003-004 administrative status-change audit trail
-- (ADR-007 "Audit Trail": user, organization, date, action, resource, result).
-- Mirrors packages/database/src/schema.ts (auditLogs).
--
-- Append-only by construction: UPDATE and DELETE are rejected by trigger for
-- every role, and RLS is enabled with no client policies (no direct client
-- access, matching the other tables). Columns intentionally carry no foreign
-- keys so that audit records survive the deletion of the entities they describe.

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  user_id uuid not null,
  organization_id uuid not null,
  action text not null,
  resource_type text not null,
  resource_id uuid not null,
  result text not null check (result in ('SUCCESS', 'FAILURE')),
  metadata jsonb
);

create index if not exists audit_logs_organization_occurred_idx
  on audit_logs (organization_id, occurred_at);

create or replace function audit_logs_block_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_logs is append-only: % is not permitted', tg_op;
end;
$$;

drop trigger if exists audit_logs_no_update on audit_logs;
create trigger audit_logs_no_update
  before update on audit_logs
  for each row execute function audit_logs_block_mutation();

drop trigger if exists audit_logs_no_delete on audit_logs;
create trigger audit_logs_no_delete
  before delete on audit_logs
  for each row execute function audit_logs_block_mutation();

alter table audit_logs enable row level security;
