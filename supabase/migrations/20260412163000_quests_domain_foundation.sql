-- ThinkerTools Quests: shared domain foundation
-- Scope: schema only for skills, activities, quests, progress, and completions.

set search_path = public;

create extension if not exists pgcrypto;

create table if not exists public.quests_skills (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  max_level integer not null default 20 check (max_level = 20),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quests_activities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  primary_skill_id uuid not null references public.quests_skills(id) on delete restrict,
  content_type text not null default 'drill' check (content_type = 'drill'),
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (recommended_level_min <= recommended_level_max)
);

create index if not exists idx_quests_activities_skill_level
  on public.quests_activities(primary_skill_id, recommended_level_min, recommended_level_max);

create table if not exists public.quests_quests (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  primary_skill_id uuid not null references public.quests_skills(id) on delete restrict,
  secondary_skill_ids uuid[] not null default '{}',
  content_type text not null default 'quest' check (content_type = 'quest'),
  narrative_hook text not null default '',
  short_description text not null default '',
  difficulty_label text not null default 'intro',
  required_skill_level integer not null default 1 check (required_skill_level >= 1 and required_skill_level <= 20),
  prerequisite_activity_ids uuid[] not null default '{}',
  prerequisite_quest_ids uuid[] not null default '{}',
  completion_criteria text not null default '',
  xp_reward integer not null check (xp_reward >= 0),
  rewards_metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quests_quests_skill_required_level
  on public.quests_quests(primary_skill_id, required_skill_level);

create table if not exists public.quests_user_skill_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  skill_id uuid not null references public.quests_skills(id) on delete cascade,
  current_level integer not null default 1 check (current_level >= 1 and current_level <= 20),
  current_level_xp integer not null default 0 check (current_level_xp >= 0),
  total_xp integer not null default 0 check (total_xp >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, skill_id)
);

create index if not exists idx_quests_user_skill_progress_user
  on public.quests_user_skill_progress(user_id);

create table if not exists public.quests_activity_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  skill_id uuid not null references public.quests_skills(id) on delete restrict,
  activity_id uuid not null references public.quests_activities(id) on delete restrict,
  content_type text not null default 'drill' check (content_type = 'drill'),
  was_successful boolean not null default true,
  awarded_xp integer not null default 0 check (awarded_xp >= 0),
  completion_metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now()
);

create index if not exists idx_quests_activity_completions_user_completed
  on public.quests_activity_completions(user_id, completed_at desc);

create table if not exists public.quests_quest_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  skill_id uuid not null references public.quests_skills(id) on delete restrict,
  quest_id uuid not null references public.quests_quests(id) on delete restrict,
  content_type text not null default 'quest' check (content_type = 'quest'),
  awarded_xp integer not null default 0 check (awarded_xp >= 0),
  completion_metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now(),
  unique (user_id, quest_id)
);

create index if not exists idx_quests_quest_completions_user_completed
  on public.quests_quest_completions(user_id, completed_at desc);

insert into public.quests_skills (slug, title, description, max_level, is_active)
values (
  'philosophical-reasoning',
  'Philosophical Reasoning',
  'Evaluate claims, tensions, and contradictions using structured reasoning.',
  20,
  true
)
on conflict (slug) do update
set
  title = excluded.title,
  description = excluded.description,
  max_level = excluded.max_level,
  is_active = excluded.is_active,
  updated_at = now();
