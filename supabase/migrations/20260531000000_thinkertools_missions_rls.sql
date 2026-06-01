-- Migration: enable RLS on the ThinkerTools Missions domain tables
--
-- Decision (per AGENTS.md two-layer access model):
--   - Catalog tables (global content, same rows for everyone): RLS ON with no
--     policies — a fail-closed backstop. Reads go through the service_role admin
--     client, which bypasses RLS, so this is zero functional change today; it
--     only closes the door on accidental direct-from-client access.
--   - Per-user tables (user_training_progress, training_activity_attempts,
--     mission_completions): RLS ON + a "users see only their own rows" policy,
--     so the DATABASE enforces per-user isolation instead of relying on every
--     API route remembering to filter by user_id.
--
-- service_role bypasses RLS, so the current server-side data path is unaffected.
-- The per-user policies only take effect if a client role (anon/authenticated)
-- ever queries these tables directly.
--
-- FUTURE (teachers viewing students): RLS policies are additive (combined with
-- OR). When a teacher/student model exists, add a SECOND policy per table like
-- `... to authenticated using (public.is_teacher_of(user_id))` alongside the
-- self-access policy below — no need to change or drop the policy below.

set search_path = public;

-- ── 1. Catalog tables: RLS on, no policies (fail-closed backstop) ─────────────
alter table public.trainings enable row level security;
alter table public.training_activity_groups enable row level security;
alter table public.training_activities enable row level security;
alter table public.missions enable row level security;

-- ── 2. Per-user tables: RLS on + self-access read policy ──────────────────────
alter table public.user_training_progress enable row level security;
alter table public.training_activity_attempts enable row level security;
alter table public.mission_completions enable row level security;

-- user_training_progress
drop policy if exists user_training_progress_self_select on public.user_training_progress;
create policy user_training_progress_self_select
on public.user_training_progress
for select
to authenticated
using (user_id = public.current_app_user_id());
-- FUTURE: add `user_training_progress_teacher_select` here for teacher access.

-- training_activity_attempts
drop policy if exists training_activity_attempts_self_select on public.training_activity_attempts;
create policy training_activity_attempts_self_select
on public.training_activity_attempts
for select
to authenticated
using (user_id = public.current_app_user_id());
-- FUTURE: add `training_activity_attempts_teacher_select` here for teacher access.

-- mission_completions
drop policy if exists mission_completions_self_select on public.mission_completions;
create policy mission_completions_self_select
on public.mission_completions
for select
to authenticated
using (user_id = public.current_app_user_id());
-- FUTURE: add `mission_completions_teacher_select` here for teacher access.
