-- Billing: STORY-004-001 post-closure correction. "Emprendedor" (MASTER_SPEC
-- §16.2 "Pago por evento. Una licencia por evento.") is the B2C one-time
-- per-event license product, not a fourth B2B/Agency recurring-subscription
-- tier. It was never a valid plan_id for Create Organization (a B2B-only
-- action) and is removed from the allowed set. See EPIC_004_BILLING.md
-- STORY-004-001 "Post-closure correction".

alter table subscriptions
  drop constraint if exists subscriptions_plan_check;
alter table subscriptions
  add constraint subscriptions_plan_check
  check (plan in ('PLANNER_ESENCIAL', 'PLANNER_PROFESIONAL', 'AGENCIA_ILIMITADA'));
