-- Identity: STORY-002-001 User Registration
-- Mirrors packages/database/src/schema.ts. Grounded in MASTER_SPEC §17
-- (Organizations), §18 (Users & Roles), §26.1/§26.2/§26.2a (Domain Model).

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  organization_type text not null check (organization_type in ('SYSTEM', 'PARTNER')),
  slug text not null unique,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key,
  email text not null unique,
  full_name text not null,
  email_verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists organization_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  organization_id uuid not null references organizations (id) on delete cascade,
  role text not null check (role in ('OWNER', 'ADMIN', 'MEMBER', 'CLIENT')),
  created_at timestamptz not null default now(),
  unique (user_id, organization_id)
);

-- MASTER_SPEC §17: exactly one SYSTEM organization exists platform-wide and
-- owns every B2C client by default (API_SPEC.md §21a "Registration Decisions").
insert into organizations (organization_type, slug, display_name)
values ('SYSTEM', 'system', 'WeddInvites')
on conflict (slug) do nothing;

-- Row Level Security: no direct client access. All access goes through the
-- API (MASTER_SPEC BR-010); these tables are only ever reached via the
-- service-role Drizzle connection used by the Identity module's
-- infrastructure layer.
alter table organizations enable row level security;
alter table users enable row level security;
alter table organization_memberships enable row level security;
