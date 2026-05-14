-- ThinkerTools Missions: rename remaining quest/skill domain tables and columns.
-- Keeps training_activities and training_activity_attempts table names.

set search_path = public;

create or replace function pg_temp.rename_constraint_if_exists(
  table_name text,
  old_constraint_name text,
  new_constraint_name text
)
returns void
language plpgsql
as $$
declare
  table_oid oid;
begin
  table_oid := to_regclass(table_name);

  if table_oid is null then
    return;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conrelid = table_oid
      and conname = old_constraint_name
  ) and not exists (
    select 1
    from pg_constraint
    where conrelid = table_oid
      and conname = new_constraint_name
  ) then
    execute format(
      'alter table %s rename constraint %I to %I',
      table_oid::regclass,
      old_constraint_name,
      new_constraint_name
    );
  end if;
end;
$$;

create or replace function pg_temp.rename_index_if_exists(
  old_index_name text,
  new_index_name text
)
returns void
language plpgsql
as $$
declare
  index_oid oid;
begin
  index_oid := to_regclass(old_index_name);

  if index_oid is null or to_regclass('public.' || new_index_name) is not null then
    return;
  end if;

  execute format(
    'alter index %s rename to %I',
    index_oid::regclass,
    new_index_name
  );
end;
$$;

do $$
begin
  if to_regclass('public.quests_skills') is not null
    and to_regclass('public.trainings') is null then
    alter table public.quests_skills rename to trainings;
  end if;

  if to_regclass('public.quests_quests') is not null
    and to_regclass('public.missions') is null then
    alter table public.quests_quests rename to missions;
  end if;

  if to_regclass('public.quests_user_skill_progress') is not null
    and to_regclass('public.user_training_progress') is null then
    alter table public.quests_user_skill_progress rename to user_training_progress;
  end if;

  if to_regclass('public.quests_quest_completions') is not null
    and to_regclass('public.mission_completions') is null then
    alter table public.quests_quest_completions rename to mission_completions;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'training_activities'
      and column_name = 'primary_skill_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'training_activities'
      and column_name = 'primary_training_id'
  ) then
    alter table public.training_activities
      rename column primary_skill_id to primary_training_id;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'training_activity_attempts'
      and column_name = 'skill_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'training_activity_attempts'
      and column_name = 'training_id'
  ) then
    alter table public.training_activity_attempts
      rename column skill_id to training_id;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'missions'
      and column_name = 'primary_skill_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'missions'
      and column_name = 'primary_training_id'
  ) then
    alter table public.missions
      rename column primary_skill_id to primary_training_id;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'missions'
      and column_name = 'secondary_skill_ids'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'missions'
      and column_name = 'secondary_training_ids'
  ) then
    alter table public.missions
      rename column secondary_skill_ids to secondary_training_ids;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'missions'
      and column_name = 'required_skill_level'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'missions'
      and column_name = 'required_training_level'
  ) then
    alter table public.missions
      rename column required_skill_level to required_training_level;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'missions'
      and column_name = 'prerequisite_quest_ids'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'missions'
      and column_name = 'prerequisite_mission_ids'
  ) then
    alter table public.missions
      rename column prerequisite_quest_ids to prerequisite_mission_ids;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_training_progress'
      and column_name = 'skill_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_training_progress'
      and column_name = 'training_id'
  ) then
    alter table public.user_training_progress
      rename column skill_id to training_id;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'mission_completions'
      and column_name = 'skill_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'mission_completions'
      and column_name = 'training_id'
  ) then
    alter table public.mission_completions
      rename column skill_id to training_id;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'mission_completions'
      and column_name = 'quest_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'mission_completions'
      and column_name = 'mission_id'
  ) then
    alter table public.mission_completions
      rename column quest_id to mission_id;
  end if;
end $$;

alter table if exists public.training_activities
  alter column content_type set default 'activity';

alter table if exists public.training_activities
  drop constraint if exists training_activities_content_type_check;

update public.training_activities
set content_type = 'activity'
where content_type in ('practice', 'drill');

alter table if exists public.training_activities
  add constraint training_activities_content_type_check
  check (content_type = 'activity');

alter table if exists public.training_activity_attempts
  alter column content_type set default 'activity';

alter table if exists public.training_activity_attempts
  drop constraint if exists training_activity_attempts_content_type_check;

update public.training_activity_attempts
set content_type = 'activity'
where content_type in ('practice', 'drill');

alter table if exists public.training_activity_attempts
  add constraint training_activity_attempts_content_type_check
  check (content_type = 'activity');

alter table if exists public.missions
  alter column content_type set default 'mission';

alter table if exists public.missions
  drop constraint if exists quests_quests_content_type_check;

alter table if exists public.missions
  drop constraint if exists missions_content_type_check;

update public.missions
set content_type = 'mission'
where content_type = 'quest';

alter table if exists public.missions
  add constraint missions_content_type_check
  check (content_type = 'mission');

alter table if exists public.mission_completions
  alter column content_type set default 'mission';

alter table if exists public.mission_completions
  drop constraint if exists quests_quest_completions_content_type_check;

alter table if exists public.mission_completions
  drop constraint if exists mission_completions_content_type_check;

update public.mission_completions
set content_type = 'mission'
where content_type = 'quest';

alter table if exists public.mission_completions
  add constraint mission_completions_content_type_check
  check (content_type = 'mission');

select pg_temp.rename_constraint_if_exists(
  'public.trainings',
  'quests_skills_pkey',
  'trainings_pkey'
);

select pg_temp.rename_constraint_if_exists(
  'public.trainings',
  'quests_skills_slug_key',
  'trainings_slug_key'
);

select pg_temp.rename_constraint_if_exists(
  'public.trainings',
  'quests_skills_max_level_check',
  'trainings_max_level_check'
);

select pg_temp.rename_constraint_if_exists(
  'public.training_activities',
  'training_activities_primary_skill_id_fkey',
  'training_activities_primary_training_id_fkey'
);

select pg_temp.rename_constraint_if_exists(
  'public.training_activity_attempts',
  'training_activity_attempts_skill_id_fkey',
  'training_activity_attempts_training_id_fkey'
);

select pg_temp.rename_constraint_if_exists(
  'public.missions',
  'quests_quests_pkey',
  'missions_pkey'
);

select pg_temp.rename_constraint_if_exists(
  'public.missions',
  'quests_quests_slug_key',
  'missions_slug_key'
);

select pg_temp.rename_constraint_if_exists(
  'public.missions',
  'quests_quests_primary_skill_id_fkey',
  'missions_primary_training_id_fkey'
);

select pg_temp.rename_constraint_if_exists(
  'public.missions',
  'quests_quests_required_skill_level_check',
  'missions_required_training_level_check'
);

select pg_temp.rename_constraint_if_exists(
  'public.missions',
  'quests_quests_xp_reward_check',
  'missions_xp_reward_check'
);

select pg_temp.rename_constraint_if_exists(
  'public.user_training_progress',
  'quests_user_skill_progress_pkey',
  'user_training_progress_pkey'
);

select pg_temp.rename_constraint_if_exists(
  'public.user_training_progress',
  'quests_user_skill_progress_user_id_fkey',
  'user_training_progress_user_id_fkey'
);

select pg_temp.rename_constraint_if_exists(
  'public.user_training_progress',
  'quests_user_skill_progress_skill_id_fkey',
  'user_training_progress_training_id_fkey'
);

select pg_temp.rename_constraint_if_exists(
  'public.user_training_progress',
  'quests_user_skill_progress_current_level_check',
  'user_training_progress_current_level_check'
);

select pg_temp.rename_constraint_if_exists(
  'public.user_training_progress',
  'quests_user_skill_progress_current_level_xp_check',
  'user_training_progress_current_level_xp_check'
);

select pg_temp.rename_constraint_if_exists(
  'public.user_training_progress',
  'quests_user_skill_progress_total_xp_check',
  'user_training_progress_total_xp_check'
);

select pg_temp.rename_constraint_if_exists(
  'public.user_training_progress',
  'quests_user_skill_progress_user_id_skill_id_key',
  'user_training_progress_user_id_training_id_key'
);

select pg_temp.rename_constraint_if_exists(
  'public.mission_completions',
  'quests_quest_completions_pkey',
  'mission_completions_pkey'
);

select pg_temp.rename_constraint_if_exists(
  'public.mission_completions',
  'quests_quest_completions_user_id_fkey',
  'mission_completions_user_id_fkey'
);

select pg_temp.rename_constraint_if_exists(
  'public.mission_completions',
  'quests_quest_completions_skill_id_fkey',
  'mission_completions_training_id_fkey'
);

select pg_temp.rename_constraint_if_exists(
  'public.mission_completions',
  'quests_quest_completions_quest_id_fkey',
  'mission_completions_mission_id_fkey'
);

select pg_temp.rename_constraint_if_exists(
  'public.mission_completions',
  'quests_quest_completions_awarded_xp_check',
  'mission_completions_awarded_xp_check'
);

select pg_temp.rename_constraint_if_exists(
  'public.mission_completions',
  'quests_quest_completions_user_id_quest_id_key',
  'mission_completions_user_id_mission_id_key'
);

select pg_temp.rename_index_if_exists(
  'public.idx_training_activities_skill_level',
  'idx_training_activities_training_level'
);

select pg_temp.rename_index_if_exists(
  'public.idx_quests_quests_skill_required_level',
  'idx_missions_training_required_level'
);

select pg_temp.rename_index_if_exists(
  'public.idx_quests_user_skill_progress_user',
  'idx_user_training_progress_user'
);

select pg_temp.rename_index_if_exists(
  'public.idx_quests_quest_completions_user_completed',
  'idx_mission_completions_user_completed'
);
