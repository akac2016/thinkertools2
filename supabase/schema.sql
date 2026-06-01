-- Thinkertools 2 hackathon schema (Supabase / Postgres)
-- Run this first in Supabase SQL Editor.

set search_path = public;

create extension if not exists pgcrypto;

-- ----------
-- Shared core
-- ----------
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username text,
  name text not null,
  email text unique,
  color text not null default '#1f2937',
  created_at timestamptz not null default now()
);

alter table public.users
  add column if not exists username text;

update public.users
set username = lower(trim(username))
where username is not null
  and username <> lower(trim(username));

update public.users u
set username = (
  case
    when prepared.candidate <> '' then left(prepared.candidate, 20) || '_' || substring(replace(u.id::text, '-', '') from 1 for 8)
    else 'user_' || substring(replace(u.id::text, '-', '') from 1 for 8)
  end
)
from (
  select
    id,
    regexp_replace(
      lower(
        coalesce(
          nullif(trim(username), ''),
          nullif(trim(name), ''),
          nullif(split_part(coalesce(email, ''), '@', 1), ''),
          ''
        )
      ),
      '[^a-z0-9._-]+',
      '',
      'g'
    ) as candidate
  from public.users
) prepared
where u.id = prepared.id
  and (
    u.username is null
    or btrim(u.username) = ''
    or u.username !~ '^[a-z0-9._-]{3,32}$'
  );

with duplicate_usernames as (
  select
    id,
    row_number() over (
      partition by username
      order by created_at asc, id asc
    ) as duplicate_rank
  from public.users
)
update public.users u
set username = left(u.username, 20) || '_' || substring(replace(u.id::text, '-', '') from 1 for 8)
from duplicate_usernames d
where u.id = d.id
  and d.duplicate_rank > 1;

alter table public.users
  alter column username set not null;

alter table public.users
  drop constraint if exists users_username_format;

alter table public.users
  add constraint users_username_format
  check (username ~ '^[a-z0-9._-]{3,32}$');

create unique index if not exists idx_users_username on public.users(username);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'manager')),
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create index if not exists idx_team_members_user_id on public.team_members(user_id);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  context_type text not null check (context_type in ('quipx_session', 'woi_game')),
  context_id uuid not null,
  author_id uuid not null references public.users(id) on delete restrict,
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_comments_context_created
  on public.comments(context_type, context_id, created_at desc);

create index if not exists idx_comments_author_created
  on public.comments(author_id, created_at desc);

-- ----------
-- Quipx
-- ----------
create table if not exists public.quipx_sessions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  creator_id uuid not null references public.users(id) on delete restrict,
  subject text not null,
  objectives text not null,
  starts_at timestamptz,
  duration_min integer check (duration_min is null or duration_min >= 0),
  status text not null default 'active' check (status in ('active', 'closed', 'archived')),
  created_at timestamptz not null default now()
);

create index if not exists idx_quipx_sessions_team_created
  on public.quipx_sessions(team_id, created_at desc);

create table if not exists public.quipx_discuss_entries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.quipx_sessions(id) on delete cascade,
  author_id uuid not null references public.users(id) on delete restrict,
  body_html text not null check (char_length(trim(body_html)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_quipx_discuss_entries_session_created
  on public.quipx_discuss_entries(session_id, created_at asc);

create table if not exists public.quipx_reflect_items (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  short_text text not null default '',
  long_text text not null default '',
  order_index integer not null check (order_index >= 1 and order_index <= 50),
  unique (order_index)
);

create table if not exists public.quipx_reflect_responses (
  id uuid primary key default gen_random_uuid(),
  reflect_item_id uuid not null references public.quipx_reflect_items(id) on delete cascade,
  score smallint not null check (score >= 1 and score <= 5),
  text text not null,
  unique (reflect_item_id, score)
);

create table if not exists public.quipx_reflections (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.quipx_sessions(id) on delete cascade,
  reflect_item_id uuid not null references public.quipx_reflect_items(id) on delete restrict,
  user_id uuid not null references public.users(id) on delete restrict,
  score smallint not null check (score >= 1 and score <= 5),
  justification text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, reflect_item_id, user_id)
);

create index if not exists idx_quipx_reflections_session_item
  on public.quipx_reflections(session_id, reflect_item_id);

create table if not exists public.quipx_improve_strategies (
  id uuid primary key default gen_random_uuid(),
  reflect_response_id uuid not null references public.quipx_reflect_responses(id) on delete cascade,
  strategy_text text not null
);

create index if not exists idx_quipx_improve_strategies_response
  on public.quipx_improve_strategies(reflect_response_id);

-- ----------
-- Web of Inquiry (WOI)
-- ----------
create table if not exists public.woi_templates (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.users(id) on delete restrict,
  name text not null,
  objective text not null,
  category text not null default 'uncategorized'
    check (category in ('structural', 'functional', 'process', 'uncategorized')),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_woi_templates_public_category
  on public.woi_templates(is_public, category, updated_at desc);

create table if not exists public.woi_template_rules (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.woi_templates(id) on delete cascade,
  order_index integer not null check (order_index >= 1 and order_index <= 7),
  rule_text text not null,
  unique (template_id, order_index)
);

create table if not exists public.woi_template_moves (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.woi_templates(id) on delete cascade,
  order_index integer not null check (order_index >= 1 and order_index <= 7),
  move_text text not null,
  unique (template_id, order_index)
);

create table if not exists public.woi_template_levels (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.woi_templates(id) on delete cascade,
  order_index integer not null check (order_index >= 1 and order_index <= 5),
  level_name text not null,
  level_objective text not null default '',
  unique (template_id, order_index)
);

create table if not exists public.woi_games (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.woi_templates(id) on delete restrict,
  team_id uuid not null references public.teams(id) on delete restrict,
  creator_id uuid not null references public.users(id) on delete restrict,
  question text not null,
  description text not null,
  is_public boolean not null default false,
  status text not null default 'in_play' check (status in ('lobby', 'in_play', 'reflect', 'finished')),
  current_player_id uuid references public.users(id) on delete set null,
  total_player_slots integer not null default 2 check (total_player_slots >= 1 and total_player_slots <= 20),
  ai_player_slots integer not null default 0 check (ai_player_slots >= 0 and ai_player_slots <= 4),
  lobby_visibility text not null default 'hidden'
    check (lobby_visibility in ('hidden', 'listed')),
  join_link_enabled boolean not null default false,
  creator_role text not null default 'player' check (creator_role in ('player', 'viewer')),
  seat_claims_locked boolean not null default false,
  check (ai_player_slots <= total_player_slots),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_woi_games_team_updated
  on public.woi_games(team_id, updated_at desc);

create index if not exists idx_woi_games_public_updated
  on public.woi_games(is_public, updated_at desc);

create table if not exists public.woi_game_ai_profiles (
  game_id uuid primary key references public.woi_games(id) on delete cascade,
  ai_player_count integer not null default 0 check (ai_player_count >= 0 and ai_player_count <= 11),
  opponents jsonb not null default '[]'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.woi_game_slots (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.woi_games(id) on delete cascade,
  slot_index integer not null check (slot_index >= 1 and slot_index <= 20),
  seat_type text not null check (seat_type in ('human', 'ai')),
  state text not null check (state in ('open', 'invited', 'filled', 'released', 'locked')),
  assigned_user_id uuid references public.users(id) on delete set null,
  ai_profile jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, slot_index),
  check (
    (seat_type = 'human' and (ai_profile is null or ai_profile = '{}'::jsonb))
    or
    (seat_type = 'ai' and assigned_user_id is null)
  )
);

create table if not exists public.woi_game_invites (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.woi_games(id) on delete cascade,
  slot_id uuid not null references public.woi_game_slots(id) on delete cascade,
  channel text not null check (channel in ('platform_search', 'email', 'join_link')),
  invited_user_id uuid references public.users(id) on delete set null,
  invited_email text,
  token_hash text,
  status text not null
    check (status in ('pending', 'sent', 'accepted', 'declined', 'expired', 'revoked', 'failed')),
  expires_at timestamptz,
  accepted_by_user_id uuid references public.users(id) on delete set null,
  accepted_at timestamptz,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_woi_game_invites_game_status
  on public.woi_game_invites(game_id, status);

create index if not exists idx_woi_game_invites_slot_status
  on public.woi_game_invites(slot_id, status);

create index if not exists idx_woi_game_invites_email
  on public.woi_game_invites(invited_email);

create index if not exists idx_woi_game_invites_user_status
  on public.woi_game_invites(invited_user_id, status);

create table if not exists public.woi_game_viewers (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.woi_games(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  anon_session_id text,
  source text not null check (source in ('lobby', 'join_link', 'public_url', 'manual')),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  left_at timestamptz,
  check (
    (user_id is not null and anon_session_id is null)
    or
    (user_id is null and anon_session_id is not null)
  )
);

create index if not exists idx_woi_game_viewers_game_active_seen
  on public.woi_game_viewers(game_id, left_at, last_seen_at);

create unique index if not exists idx_woi_game_viewers_active_auth_unique
  on public.woi_game_viewers(game_id, user_id)
  where user_id is not null and left_at is null;

create unique index if not exists idx_woi_game_viewers_active_anon_unique
  on public.woi_game_viewers(game_id, anon_session_id)
  where anon_session_id is not null and left_at is null;

create table if not exists public.woi_game_join_links (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.woi_games(id) on delete cascade,
  token_hash text not null unique,
  status text not null check (status in ('active', 'revoked', 'expired')),
  max_claims integer check (max_claims is null or max_claims > 0),
  claims_count integer not null default 0,
  expires_at timestamptz,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.woi_roster_presets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  name text not null,
  source_game_id uuid references public.woi_games(id) on delete set null,
  slots jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.woi_turns (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.woi_games(id) on delete cascade,
  level_index integer check (level_index is null or (level_index >= 0 and level_index <= 5)),
  player_id uuid not null references public.users(id) on delete restrict,
  move_id uuid references public.woi_template_moves(id) on delete set null,
  rule_id uuid references public.woi_template_rules(id) on delete set null,
  content_html text not null check (char_length(trim(content_html)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_woi_turns_game_created
  on public.woi_turns(game_id, created_at asc);

create index if not exists idx_woi_turns_game_level_created
  on public.woi_turns(game_id, level_index, created_at asc);

-- ----------
-- Instrumentation / observability
-- ----------
create table if not exists public.event_log (
  id uuid primary key default gen_random_uuid(),
  request_id uuid,
  actor_id uuid references public.users(id) on delete set null,
  event_name text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_event_log_event_created
  on public.event_log(event_name, created_at desc);

create index if not exists idx_event_log_entity
  on public.event_log(entity_type, entity_id);

create index if not exists idx_event_log_actor_created
  on public.event_log(actor_id, created_at desc);

create index if not exists idx_event_log_metadata_gin
  on public.event_log using gin (metadata);

create table if not exists public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid,
  feature text not null
    check (feature in (
      'template_generation',
      'turn_assist',
      'summary',
      'other',
      'authoring_activity',
      'authoring_mission'
    )),
  model text not null,
  status text not null check (status in ('success', 'error')),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  prompt_preview text not null default '',
  response_preview text not null default '',
  error_text text not null default '',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_runs_feature_created
  on public.ai_runs(feature, created_at desc);

create index if not exists idx_ai_runs_status_created
  on public.ai_runs(status, created_at desc);

create index if not exists idx_ai_runs_request
  on public.ai_runs(request_id);

-- ----------
-- ThinkerTools Missions domain
-- ----------
-- Reconstructed from the migration history (originally the "quests" domain,
-- renamed to trainings/missions). These tables live only in migrations; this
-- block mirrors their CURRENT post-migration shape for posterity. They are
-- accessed exclusively through the service_role admin client.
create table if not exists public.trainings (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  max_level integer not null default 20 check (max_level = 20),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_activity_groups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  training_id uuid not null references public.trainings(id) on delete restrict,
  template_family text not null default '',
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_training_activity_groups_training
  on public.training_activity_groups(training_id, display_order);

create table if not exists public.training_activities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  primary_training_id uuid not null references public.trainings(id) on delete restrict,
  content_type text not null default 'activity' check (content_type = 'activity'),
  template_family text not null,
  short_description text not null default '',
  difficulty_label text not null default 'intro',
  completion_criteria text not null default '',
  xp_reward integer not null check (xp_reward >= 0),
  recommended_level_min integer not null check (recommended_level_min >= 1 and recommended_level_min <= 20),
  recommended_level_max integer not null check (recommended_level_max >= 1 and recommended_level_max <= 20),
  overlevel_grace_levels integer not null default 2 check (overlevel_grace_levels = 2),
  repeatable boolean not null default true,
  is_active boolean not null default true,
  round_content jsonb not null default '{}'::jsonb,
  activity_group_id uuid references public.training_activity_groups(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (recommended_level_min <= recommended_level_max)
);

create index if not exists idx_training_activities_training_level
  on public.training_activities(primary_training_id, recommended_level_min, recommended_level_max);

create index if not exists idx_training_activities_group
  on public.training_activities(activity_group_id);

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  primary_training_id uuid not null references public.trainings(id) on delete restrict,
  secondary_training_ids uuid[] not null default '{}',
  content_type text not null default 'mission' check (content_type = 'mission'),
  narrative_hook text not null default '',
  short_description text not null default '',
  difficulty_label text not null default 'intro',
  required_training_level integer not null default 1 check (required_training_level >= 1 and required_training_level <= 20),
  prerequisite_training_activity_ids uuid[] not null default '{}',
  prerequisite_mission_ids uuid[] not null default '{}',
  completion_criteria text not null default '',
  xp_reward integer not null check (xp_reward >= 0),
  rewards_metadata jsonb not null default '{}'::jsonb,
  mission_body jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_missions_training_required_level
  on public.missions(primary_training_id, required_training_level);

create table if not exists public.user_training_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  training_id uuid not null references public.trainings(id) on delete cascade,
  current_level integer not null default 1 check (current_level >= 1 and current_level <= 20),
  current_level_xp integer not null default 0 check (current_level_xp >= 0),
  total_xp integer not null default 0 check (total_xp >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, training_id)
);

create index if not exists idx_user_training_progress_user
  on public.user_training_progress(user_id);

create table if not exists public.training_activity_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  training_id uuid not null references public.trainings(id) on delete restrict,
  training_activity_id uuid not null references public.training_activities(id) on delete restrict,
  content_type text not null default 'activity' check (content_type = 'activity'),
  was_successful boolean not null default true,
  awarded_xp integer not null default 0 check (awarded_xp >= 0),
  completion_metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now()
);

create index if not exists idx_training_activity_attempts_user_completed
  on public.training_activity_attempts(user_id, completed_at desc);

create table if not exists public.mission_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  training_id uuid not null references public.trainings(id) on delete restrict,
  mission_id uuid not null references public.missions(id) on delete restrict,
  content_type text not null default 'mission' check (content_type = 'mission'),
  awarded_xp integer not null default 0 check (awarded_xp >= 0),
  completion_metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now(),
  unique (user_id, mission_id)
);

create index if not exists idx_mission_completions_user_completed
  on public.mission_completions(user_id, completed_at desc);

create table if not exists public.content_drafts (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('activity','mission')),
  status text not null default 'draft'
    check (status in ('draft','valid','published','archived')),
  origin text not null default 'manual'
    check (origin in ('manual','ai','co_authored')),
  primary_training_id uuid not null references public.trainings(id) on delete restrict,
  title text not null default '',
  slug text,
  body jsonb not null default '{}'::jsonb,
  validation_issues jsonb not null default '[]'::jsonb,
  ai_source text,
  ai_model text,
  published_ref_id uuid,
  activity_group_id uuid references public.training_activity_groups(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_content_drafts_creator_updated
  on public.content_drafts(created_by, updated_at desc);

create index if not exists idx_content_drafts_group
  on public.content_drafts(activity_group_id);
