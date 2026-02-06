-- Thinkertools 2 hackathon schema (Supabase / Postgres)
-- Run this first in Supabase SQL Editor.

set search_path = public;

create extension if not exists pgcrypto;

-- ----------
-- Shared core
-- ----------
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique,
  color text not null default '#1f2937',
  created_at timestamptz not null default now()
);

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
  status text not null default 'in_play' check (status in ('in_play', 'reflect', 'finished')),
  current_player_id uuid references public.users(id) on delete set null,
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
    check (feature in ('template_generation', 'turn_assist', 'summary', 'other')),
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
