-- Identity: STORY-002-007 Internal User / Team Management
-- Mirrors packages/database/src/schema.ts.

alter table organization_memberships
  add column if not exists status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'SUSPENDED', 'REMOVED'));

create table if not exists user_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  email text not null,
  role text not null check (role in ('OWNER', 'ADMIN', 'MEMBER', 'CLIENT')),
  token_hash text not null unique,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED')),
  invited_by uuid not null references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz
);

create index if not exists user_invitations_org_email_idx
  on user_invitations (organization_id, email);

-- Row Level Security: no direct client access, same policy as every other
-- Identity table (see 20260809000000_identity_registration.sql).
alter table user_invitations enable row level security;
