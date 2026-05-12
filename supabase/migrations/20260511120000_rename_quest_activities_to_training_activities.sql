-- ThinkerTools Quests: rename legacy activity tables to training naming.
-- This keeps existing local databases moving forward without a reset.

set search_path = public;

do $$
begin
  if to_regclass('public.quests_activities') is not null
    and to_regclass('public.training_activities') is null then
    alter table public.quests_activities rename to training_activities;
  end if;

  if to_regclass('public.quests_activity_completions') is not null
    and to_regclass('public.training_activity_attempts') is null then
    alter table public.quests_activity_completions rename to training_activity_attempts;
  end if;
end $$;

alter table if exists public.training_activities
  add column if not exists round_content jsonb not null default '{}'::jsonb;

alter table if exists public.training_activities
  alter column content_type set default 'practice';

alter table if exists public.training_activities
  drop constraint if exists quests_activities_content_type_check;

alter table if exists public.training_activities
  drop constraint if exists training_activities_content_type_check;

update public.training_activities
set content_type = 'practice'
where content_type = 'drill';

alter table if exists public.training_activities
  add constraint training_activities_content_type_check
  check (content_type = 'practice');

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'training_activity_attempts'
      and column_name = 'activity_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'training_activity_attempts'
      and column_name = 'training_activity_id'
  ) then
    alter table public.training_activity_attempts
      rename column activity_id to training_activity_id;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'quests_quests'
      and column_name = 'prerequisite_activity_ids'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'quests_quests'
      and column_name = 'prerequisite_training_activity_ids'
  ) then
    alter table public.quests_quests
      rename column prerequisite_activity_ids to prerequisite_training_activity_ids;
  end if;
end $$;

alter table if exists public.training_activity_attempts
  alter column content_type set default 'practice';

alter table if exists public.training_activity_attempts
  drop constraint if exists quests_activity_completions_content_type_check;

alter table if exists public.training_activity_attempts
  drop constraint if exists training_activity_attempts_content_type_check;

update public.training_activity_attempts
set content_type = 'practice'
where content_type = 'drill';

alter table if exists public.training_activity_attempts
  add constraint training_activity_attempts_content_type_check
  check (content_type = 'practice');

alter index if exists public.idx_quests_activities_skill_level
  rename to idx_training_activities_skill_level;

alter index if exists public.idx_quests_activity_completions_user_completed
  rename to idx_training_activity_attempts_user_completed;
