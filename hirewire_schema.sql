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

-- Postgres has no "create type if not exists", so guard it explicitly.
-- Without this the whole file fails on a second run and every statement
-- after this point — including the RLS policies — is silently skipped.
do $$
begin
  create type public.app_status as enum (
    'Applied',
    'Reply Received',
    'Interview',
    'Offer',
    'Rejected',
    'Withdrawn'
  );
exception
  when duplicate_object then null;
end
$$;

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
drop policy if exists "users: own row only" on public.users;
create policy "users: own row only"
  on public.users for all
  using (auth.uid() = id);

-- Integrations: the browser must never be able to READ the OAuth tokens,
-- but still needs to manage its own row (the OAuth callback upserts, the
-- Disconnect button deletes).
--
-- RLS is ROW-level, so it cannot hide individual columns — and dropping the
-- select policy outright does not work either: PostgreSQL requires SELECT
-- privileges for UPDATE/DELETE statements that reference table columns, so a
-- `delete ... where provider = 'gmail'` or an `on conflict` upsert would
-- silently match zero rows. Row visibility therefore stays, and COLUMN-level
-- grants below are what actually keep the tokens unreadable.
drop policy if exists "integrations: own rows only" on public.integrations;
drop policy if exists "integrations: select own"    on public.integrations;
drop policy if exists "integrations: insert own"    on public.integrations;
drop policy if exists "integrations: update own"    on public.integrations;
drop policy if exists "integrations: delete own"    on public.integrations;

create policy "integrations: select own"
  on public.integrations for select
  using (auth.uid() = user_id);

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

-- Column-level privileges: this is what stops an XSS from reading a
-- long-lived Gmail refresh token. The browser roles get SELECT on the
-- harmless columns only -- never access_token or refresh_token.
--
-- Writes do NOT go through these grants at all. An `on conflict do update`
-- upsert requires TABLE-level SELECT (column grants are not enough), which
-- would hand the tokens straight back to the browser. So token writes go
-- through set_gmail_integration() below instead, and the browser role is
-- given no insert/update privilege whatsoever.
revoke all on public.integrations from anon, authenticated;

grant select (id, user_id, provider, token_expires_at, scope, created_at, updated_at)
  on public.integrations to authenticated;

-- DELETE is safe to expose directly: RLS limits it to the caller's own row
-- and it leaks nothing. This is what the Disconnect button uses.
grant delete on public.integrations to authenticated;

-- The scanner backend uses the service_role key, which bypasses RLS and
-- needs the tokens in full.
grant all on public.integrations to service_role;

-- Token writer. security definer so it runs as the owner and needs no table
-- privileges on the caller's side; auth.uid() is baked in, so a caller can
-- only ever write their OWN row and cannot read anything back.
create or replace function public.set_gmail_integration(
  p_access_token    text,
  p_refresh_token   text,
  p_token_expires_at timestamptz,
  p_scope           text
) returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.integrations
    (user_id, provider, access_token, refresh_token, token_expires_at, scope)
  values
    (auth.uid(), 'gmail', p_access_token, p_refresh_token, p_token_expires_at, p_scope)
  on conflict (user_id, provider) do update
    set access_token     = excluded.access_token,
        refresh_token    = excluded.refresh_token,
        token_expires_at = excluded.token_expires_at,
        scope            = excluded.scope;
end;
$$;

revoke all on function public.set_gmail_integration(text, text, timestamptz, text) from anon;
grant execute on function public.set_gmail_integration(text, text, timestamptz, text) to authenticated;

-- Convenience read surface for the frontend: connection status, no tokens.
-- Security-definer (security_invoker = false) so it reads past RLS; the
-- explicit auth.uid() predicate is what scopes it to the caller.
drop view if exists public.integration_status;
create view public.integration_status
  with (security_invoker = false) as
  select id, user_id, provider, created_at, updated_at
  from public.integrations
  where user_id = (select auth.uid());

revoke all on public.integration_status from anon;
grant select on public.integration_status to authenticated;

-- Folders: full CRUD on own rows
drop policy if exists "folders: own rows only" on public.folders;
create policy "folders: own rows only"
  on public.folders for all
  using (auth.uid() = user_id);

-- Applications: full CRUD on own rows
drop policy if exists "applications: own rows only" on public.applications;
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
-- Re-runnable: yes — every statement is guarded, safe to run repeatedly
-- ============================================================
