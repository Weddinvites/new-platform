-- Organizations: STORY-003-004 Activate / Suspend Organization
-- Mirrors packages/database/src/schema.ts (organizations.organizationStatus).

alter table organizations
  add column if not exists organization_status text not null default 'ACTIVE';

alter table organizations
  drop constraint if exists organizations_organization_status_check;

alter table organizations
  add constraint organizations_organization_status_check
  check (organization_status in ('ACTIVE', 'SUSPENDED'));
