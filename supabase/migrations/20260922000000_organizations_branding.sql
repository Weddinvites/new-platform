-- Organizations: STORY-003-005 White Label / Branding Configuration
-- Mirrors packages/database/src/schema.ts.

alter table organizations
  add column if not exists brand_name text,
  add column if not exists logo text,
  add column if not exists primary_color text,
  add column if not exists secondary_color text;
