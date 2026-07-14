-- TEMPLATE — copy this when a migration adds a new table in the public schema.
-- Rename the file to: <UTC timestamp>_<description>.sql  (e.g. 20260601120000_widgets.sql)
--
-- WORKFLOW (this project does NOT use the Supabase CLI):
--   1. Write the migration from this template.
--   2. Run it in the Supabase SQL editor.
--   3. Mirror the new table + its grants/RLS/policies into supabase/schema.sql
--      and supabase/policies.sql — those files are posterity docs that agents
--      read to understand the DB, so they must stay in sync.
--
-- WHY THE GRANT STEP EXISTS
-- Supabase changed the default for new public tables: a table is NOT reachable
-- via the Data API (PostgREST / GraphQL / supabase-js) until an explicit GRANT
-- is added. This project is an EXISTING Supabase project, so the relevant date
-- is Oct 30, 2026 — when the new default-deny is enforced here. From that point,
-- any new public table created without a grant returns, on every Data API call:
--   { "code": "42501", "message": "permission denied for table public.<table>" }
-- Tables created before then keep their implicit grants and are unaffected; this
-- template is about getting NEW tables right going forward.
--
-- Treat GRANT → ENABLE RLS → POLICIES as one unit in the same migration.
-- Grants decide whether a role can touch the table at all; RLS decides which
-- rows it sees. Postgres checks the grant BEFORE RLS, so you need both.
-- Use SCOPED grants per role — never blanket-grant everything to all roles.
--
-- BEFORE FILLING THIS IN: work through the two-layer decision in AGENTS.md.
-- Layer A (intent): who owns each row, what's the blast radius of a cross-user
-- leak, and should the DATABASE enforce ownership (RLS) or only app-code filters
-- — i.e. is "everything via service_role" deliberate or just convenience?
-- Layer B (mechanics): who reads/writes, is it public, which rows per role,
-- read vs write. The answers decide which grants and policies below you keep.

set search_path = public;

-- ── 1. Create the table ───────────────────────────────────────────────────────
create table if not exists public.your_table (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  -- ... columns ...
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── 2. Grant Data API access (scoped per role) ────────────────────────────────
-- service_role: the admin client (lib/supabase/admin.ts) — bypasses RLS.
-- Almost every table in this app needs this; reads and writes go through it.
grant select, insert, update, delete on public.your_table to service_role;

-- authenticated: signed-in users reading via the Data API. Add ONLY if a client
-- reads this table directly; rows are scoped by the RLS policy below. Most
-- tables in this app are server-only (service_role) and need NO client grant.
-- grant select on public.your_table to authenticated;

-- anon: ONLY if the data is genuinely public (e.g. public games/templates).
-- grant select on public.your_table to anon;

-- If this table uses a sequence (bigint identity / serial — this app uses uuid
-- PKs, so usually NOT needed), the inserting client role also needs:
-- grant usage, select on sequence public.your_table_id_seq to authenticated;

-- ── 3. Enable RLS ─────────────────────────────────────────────────────────────
alter table public.your_table enable row level security;

-- ── 4. Policies (scope rows per role) ─────────────────────────────────────────
-- Only needed for tables a client role reads/writes directly. service_role
-- bypasses RLS, so server-only tables need a grant + enabled RLS but no policy.
-- create policy "users read their own rows"
--   on public.your_table
--   for select
--   to authenticated
--   using (user_id = public.current_app_user_id());
