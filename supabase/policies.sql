-- Thinkertools 2 demo RLS policies
-- Run after schema.sql and seed.sql.

set search_path = public;

-- ----------
-- Ensure RLS is enabled on all app tables
-- ----------
alter table public.users enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.comments enable row level security;

alter table public.quipx_sessions enable row level security;
alter table public.quipx_discuss_entries enable row level security;
alter table public.quipx_reflect_items enable row level security;
alter table public.quipx_reflect_responses enable row level security;
alter table public.quipx_reflections enable row level security;
alter table public.quipx_improve_strategies enable row level security;

alter table public.woi_templates enable row level security;
alter table public.woi_template_rules enable row level security;
alter table public.woi_template_moves enable row level security;
alter table public.woi_template_levels enable row level security;
alter table public.woi_games enable row level security;
alter table public.woi_game_slots enable row level security;
alter table public.woi_game_invites enable row level security;
alter table public.woi_game_viewers enable row level security;
alter table public.woi_game_join_links enable row level security;
alter table public.woi_roster_presets enable row level security;
alter table public.woi_turns enable row level security;

alter table public.event_log enable row level security;
alter table public.ai_runs enable row level security;

-- ThinkerTools Missions domain — RLS added in migration
-- 20260531000000_thinkertools_missions_rls.sql.
-- Catalog tables: RLS on, no policies (fail-closed backstop; reads go through
-- service_role, which bypasses RLS).
alter table public.trainings enable row level security;
alter table public.training_activity_groups enable row level security;
alter table public.training_activities enable row level security;
alter table public.missions enable row level security;
-- Per-user tables: RLS on + self-access policies (defined below).
alter table public.user_training_progress enable row level security;
alter table public.training_activity_attempts enable row level security;
alter table public.mission_completions enable row level security;

-- ----------
-- Helper functions (auth -> app user resolution)
-- ----------
create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select x.id
  from (
    select u.id, 1 as ord
    from public.users u
    where u.id = auth.uid()

    union all

    select u.id, 2 as ord
    from public.users u
    where u.email is not null
      and lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  ) x
  order by x.ord
  limit 1;
$$;

create or replace function public.is_team_member(_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = _team_id
      and tm.user_id = public.current_app_user_id()
  );
$$;

create or replace function public.has_filled_human_seat(_game_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.woi_game_slots s
    where s.game_id = _game_id
      and s.seat_type = 'human'
      and s.assigned_user_id = _user_id
  );
$$;

create or replace function public.has_active_viewer_session(_game_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.woi_game_viewers v
    where v.game_id = _game_id
      and v.user_id = _user_id
      and v.left_at is null
  );
$$;

create or replace function public.can_read_game(_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.woi_games g
    where g.id = _game_id
      and (
        g.is_public = true
        or g.creator_id = public.current_app_user_id()
        or public.is_team_member(g.team_id)
        or public.has_filled_human_seat(g.id, public.current_app_user_id())
        or public.has_active_viewer_session(g.id, public.current_app_user_id())
      )
  );
$$;

create or replace function public.can_read_session(_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.quipx_sessions s
    where s.id = _session_id
      and (
        s.creator_id = public.current_app_user_id()
        or public.is_team_member(s.team_id)
      )
  );
$$;

-- ----------
-- Drop existing policies (idempotent reruns)
-- ----------
drop policy if exists teams_member_select on public.teams;
drop policy if exists team_members_member_select on public.team_members;

drop policy if exists quipx_sessions_member_select on public.quipx_sessions;
drop policy if exists quipx_discuss_entries_member_select on public.quipx_discuss_entries;
drop policy if exists quipx_reflect_items_auth_select on public.quipx_reflect_items;
drop policy if exists quipx_reflect_responses_auth_select on public.quipx_reflect_responses;
drop policy if exists quipx_reflections_member_select on public.quipx_reflections;
drop policy if exists quipx_improve_strategies_auth_select on public.quipx_improve_strategies;

drop policy if exists woi_templates_public_or_owner_select on public.woi_templates;
drop policy if exists woi_template_rules_visible_select on public.woi_template_rules;
drop policy if exists woi_template_moves_visible_select on public.woi_template_moves;
drop policy if exists woi_template_levels_visible_select on public.woi_template_levels;
drop policy if exists woi_games_visible_select on public.woi_games;
drop policy if exists woi_game_slots_visible_select on public.woi_game_slots;
drop policy if exists woi_game_invites_visible_select on public.woi_game_invites;
drop policy if exists woi_game_viewers_visible_select on public.woi_game_viewers;
drop policy if exists woi_game_join_links_visible_select on public.woi_game_join_links;
drop policy if exists woi_roster_presets_owner_select on public.woi_roster_presets;
drop policy if exists woi_turns_visible_select on public.woi_turns;

drop policy if exists comments_visible_select on public.comments;

drop policy if exists user_training_progress_self_select on public.user_training_progress;
drop policy if exists training_activity_attempts_self_select on public.training_activity_attempts;
drop policy if exists mission_completions_self_select on public.mission_completions;

-- ----------
-- Team/membership read policies (authenticated only)
-- ----------
create policy teams_member_select
on public.teams
for select
to authenticated
using (public.is_team_member(id));

create policy team_members_member_select
on public.team_members
for select
to authenticated
using (public.is_team_member(team_id));

-- ----------
-- Quipx read policies (team/private)
-- ----------
create policy quipx_sessions_member_select
on public.quipx_sessions
for select
to authenticated
using (public.can_read_session(id));

create policy quipx_discuss_entries_member_select
on public.quipx_discuss_entries
for select
to authenticated
using (public.can_read_session(session_id));

create policy quipx_reflect_items_auth_select
on public.quipx_reflect_items
for select
to authenticated
using (true);

create policy quipx_reflect_responses_auth_select
on public.quipx_reflect_responses
for select
to authenticated
using (true);

create policy quipx_reflections_member_select
on public.quipx_reflections
for select
to authenticated
using (public.can_read_session(session_id));

create policy quipx_improve_strategies_auth_select
on public.quipx_improve_strategies
for select
to authenticated
using (true);

-- ----------
-- WOI read policies (public + team/private)
-- ----------
create policy woi_templates_public_or_owner_select
on public.woi_templates
for select
to anon, authenticated
using (
  is_public = true
  or creator_id = public.current_app_user_id()
);

create policy woi_template_rules_visible_select
on public.woi_template_rules
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.woi_templates t
    where t.id = template_id
      and (
        t.is_public = true
        or t.creator_id = public.current_app_user_id()
      )
  )
);

create policy woi_template_moves_visible_select
on public.woi_template_moves
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.woi_templates t
    where t.id = template_id
      and (
        t.is_public = true
        or t.creator_id = public.current_app_user_id()
      )
  )
);

create policy woi_template_levels_visible_select
on public.woi_template_levels
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.woi_templates t
    where t.id = template_id
      and (
        t.is_public = true
        or t.creator_id = public.current_app_user_id()
      )
  )
);

create policy woi_games_visible_select
on public.woi_games
for select
to anon, authenticated
using (
  is_public = true
  or creator_id = public.current_app_user_id()
  or public.is_team_member(team_id)
  or public.has_filled_human_seat(id, public.current_app_user_id())
  or public.has_active_viewer_session(id, public.current_app_user_id())
);

create policy woi_game_slots_visible_select
on public.woi_game_slots
for select
to anon, authenticated
using (public.can_read_game(game_id));

create policy woi_game_invites_visible_select
on public.woi_game_invites
for select
to authenticated
using (
  created_by = public.current_app_user_id()
  or invited_user_id = public.current_app_user_id()
);

create policy woi_game_viewers_visible_select
on public.woi_game_viewers
for select
to anon, authenticated
using (public.can_read_game(game_id));

create policy woi_game_join_links_visible_select
on public.woi_game_join_links
for select
to authenticated
using (created_by = public.current_app_user_id());

create policy woi_roster_presets_owner_select
on public.woi_roster_presets
for select
to authenticated
using (owner_user_id = public.current_app_user_id());

create policy woi_turns_visible_select
on public.woi_turns
for select
to anon, authenticated
using (public.can_read_game(game_id));

-- ----------
-- Comments read policy
-- ----------
create policy comments_visible_select
on public.comments
for select
to anon, authenticated
using (
  (
    context_type = 'woi_game'
    and public.can_read_game(context_id)
  )
  or
  (
    context_type = 'quipx_session'
    and public.can_read_session(context_id)
  )
);

-- Note:
-- No INSERT/UPDATE/DELETE policies are created intentionally.
-- Client-side writes are denied; perform writes via server-side service role.

-- ----------
-- ThinkerTools Missions: per-user read policies
-- ----------
-- Catalog tables (trainings, training_activity_groups, training_activities,
-- missions) have RLS enabled above with NO policy — fail-closed backstop;
-- reads run through service_role, which bypasses RLS.
--
-- The per-user tables below restrict client reads to the user's own rows.
-- FUTURE (teachers viewing students): policies are additive (OR'd), so add a
-- second `..._teacher_select` policy per table when a teacher/student model
-- exists — no change to the self-access policies below.

create policy user_training_progress_self_select
on public.user_training_progress
for select
to authenticated
using (user_id = public.current_app_user_id());

create policy training_activity_attempts_self_select
on public.training_activity_attempts
for select
to authenticated
using (user_id = public.current_app_user_id());

create policy mission_completions_self_select
on public.mission_completions
for select
to authenticated
using (user_id = public.current_app_user_id());

-- content_drafts intentionally omitted here: it is the authoring/create-side
-- table, not part of the missions consumer feature, and currently has RLS off.
-- Revisit it with the authoring flow, not here.
