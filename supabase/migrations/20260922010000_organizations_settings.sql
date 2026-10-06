-- Organizations: STORY-003-006 Organization Settings
-- Mirrors packages/database/src/schema.ts.

alter table organizations
  add column if not exists support_contact_email text;
