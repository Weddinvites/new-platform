-- Billing: STORY-004-001 Subscription Creation at Purchase, Retrieve, and
-- Trial Enforcement. Mirrors packages/database/src/schema.ts.

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references organizations(id) on delete cascade,
  plan text not null,
  status text not null default 'TRIAL',
  trial_ends_at timestamptz,
  created_at timestamptz not null default now()
);

alter table subscriptions
  drop constraint if exists subscriptions_plan_check;
alter table subscriptions
  add constraint subscriptions_plan_check
  check (plan in ('EMPRENDEDOR', 'PLANNER_ESENCIAL', 'PLANNER_PROFESIONAL', 'AGENCIA_ILIMITADA'));

alter table subscriptions
  drop constraint if exists subscriptions_status_check;
alter table subscriptions
  add constraint subscriptions_status_check
  check (status in ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED', 'EXPIRED'));
