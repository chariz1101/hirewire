-- ============================================================
-- HireWire — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. USERS ─────────────────────────────────────────────────
-- Supabase Auth manages the auth.users table automatically.
-- We create a public mirror for app-level data.

create table if not exists public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  created_at  timestamptz not null default now()
);

-- Auto-populate on new signup via trigger
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ── 2. INTEGRATIONS ──────────────────────────────────────────
-- Stores OAuth tokens per provider (Gmail now, extensible later).
-- Keeping this separate from users keeps auth clean and supports
-- multiple providers (e.g. Outlook) without schema changes.

create table if not exists public.integrations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users (id) on delete cascade,
  provider        text not null,                  -- 'gmail', 'outlook', etc.
  access_token    text not null,
  refresh_token   text not null,                  -- critical: never omit
  token_expires_at timestamptz not null,
  scope           text,                           -- e.g. 'https://www.googleapis.com/auth/gmail.readonly'
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, provider)                      -- one token set per user per provider
);

-- Auto-update updated_at on upsert
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists integrations_updated_at on public.integrations;
create trigger integrations_updated_at
  before update on public.integrations
  for each row execute procedure public.set_updated_at();


-- ── 3. FOLDERS ───────────────────────────────────────────────
-- User-defined workspaces, e.g. "OJT 2026", "Remote Roles"

create table if not exists public.folders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);


-- ── 4. APPLICATIONS ──────────────────────────────────────────
-- Core tracker table. Each row = one job application.

create type public.app_status as enum (
  'Applied',
  'Reply Received',
  'Interview',
  'Offer',
  'Rejected',
  'Withdrawn'
);

create table if not exists public.applications (
  id                  uuid primary key default gen_random_uuid(),
  folder_id           uuid not null references public.folders (id) on delete cascade,
  user_id             uuid not null references public.users (id) on delete cascade,
  job_title           text not null,
  company_name        text not null,
  company_email       text,                       -- used by Gmail scanner to match senders
  job_url             text,
  notes               text,
  status              public.app_status not null default 'Applied',
  reminder_preference integer check (reminder_preference in (3, 7, 14)),  -- days
  date_applied        date not null default current_date,
  last_email_received timestamptz,               -- set by Gmail scanner
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

drop trigger if exists applications_updated_at on public.applications;
create trigger applications_updated_at
  before update on public.applications
  for each row execute procedure public.set_updated_at();


-- ── 5. ROW-LEVEL SECURITY (RLS) ──────────────────────────────
-- Critical: each user sees ONLY their own rows.

alter table public.users        enable row level security;
alter table public.integrations enable row level security;
alter table public.folders      enable row level security;
alter table public.applications enable row level security;

-- Users: can only read/update their own profile
create policy "users: own row only"
  on public.users for all
  using (auth.uid() = id);

-- Integrations: the browser may WRITE its own tokens (the OAuth callback
-- upserts them) and DELETE them (the Disconnect button), but must never be
-- able to SELECT them. There is deliberately no select policy here: with RLS
-- enabled and no permissive policy, reads from the anon/authenticated client
-- are denied, so an XSS cannot exfiltrate a long-lived Gmail refresh token.
-- The scanner backend uses the service_role key, which bypasses RLS.
drop policy if exists "integrations: own rows only"   on public.integrations;
drop policy if exists "integrations: insert own"      on public.integrations;
drop policy if exists "integrations: update own"      on public.integrations;
drop policy if exists "integrations: delete own"      on public.integrations;

create policy "integrations: insert own"
  on public.integrations for insert
  with check (auth.uid() = user_id);

create policy "integrations: update own"
  on public.integrations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "integrations: delete own"
  on public.integrations for delete
  using (auth.uid() = user_id);

-- Connection STATUS, without the tokens. The frontend only needs to know
-- whether a provider is linked. This is a security-definer view (the default,
-- security_invoker = false), so it reads past the table's RLS; the explicit
-- auth.uid() predicate is what scopes it to the caller.
create or replace view public.integration_status
  with (security_invoker = false) as
  select id, user_id, provider, created_at, updated_at
  from public.integrations
  where user_id = (select auth.uid());

revoke all on public.integration_status from anon;
grant select on public.integration_status to authenticated;

-- Folders: full CRUD on own rows
create policy "folders: own rows only"
  on public.folders for all
  using (auth.uid() = user_id);

-- Applications: full CRUD on own rows
create policy "applications: own rows only"
  on public.applications for all
  using (auth.uid() = user_id);

-- FastAPI service role bypass (for the reminder engine & Gmail scanner)
-- Grant your FastAPI backend the service_role key in env vars.
-- service_role bypasses RLS automatically — no extra policy needed.


-- ── 6. INDEXES ───────────────────────────────────────────────
-- Speed up the daily reminder engine query significantly.

create index if not exists idx_applications_reminder
  on public.applications (user_id, status, date_applied, reminder_preference)
  where status = 'Applied';

-- Speed up Gmail scanner lookups by company_email
create index if not exists idx_applications_company_email
  on public.applications (company_email)
  where company_email is not null;

-- Speed up folder listings per user
create index if not exists idx_folders_user_id
  on public.folders (user_id);


-- ── DONE ─────────────────────────────────────────────────────
-- Tables:      users, integrations, folders, applications
-- Views:       integration_status (tokenless view of integrations)
-- Triggers:    handle_new_user, set_updated_at (×2)
-- RLS:         enabled on all 4 tables
-- Indexes:     3 targeted indexes for reminder engine + scanner
-- ============================================================
