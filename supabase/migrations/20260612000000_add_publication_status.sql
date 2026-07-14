-- Migration: Add publication_status column and drop is_active
-- This enables a staged publishing workflow where educators can submit content
-- that waits for approval before going live to players.

-- ============================================================================
-- 1. Add publication_status to trainings
-- ============================================================================
alter table public.trainings
  add column publication_status text not null default 'pending'
    check (publication_status in ('pending', 'live', 'archived'));

-- Backfill existing rows based on is_active
update public.trainings
  set publication_status = case
    when is_active then 'live'
    else 'archived'
  end;

-- Drop is_active now that publication_status has the data
alter table public.trainings
  drop column is_active;

-- ============================================================================
-- 2. Add publication_status to training_activity_groups
-- ============================================================================
alter table public.training_activity_groups
  add column publication_status text not null default 'pending'
    check (publication_status in ('pending', 'live', 'archived'));

update public.training_activity_groups
  set publication_status = case
    when is_active then 'live'
    else 'archived'
  end;

alter table public.training_activity_groups
  drop column is_active;

-- ============================================================================
-- 3. Add publication_status to training_activities
-- ============================================================================
alter table public.training_activities
  add column publication_status text not null default 'pending'
    check (publication_status in ('pending', 'live', 'archived'));

update public.training_activities
  set publication_status = case
    when is_active then 'live'
    else 'archived'
  end;

alter table public.training_activities
  drop column is_active;

-- ============================================================================
-- 4. Add publication_status to missions
-- ============================================================================
alter table public.missions
  add column publication_status text not null default 'pending'
    check (publication_status in ('pending', 'live', 'archived'));

update public.missions
  set publication_status = case
    when is_active then 'live'
    else 'archived'
  end;

alter table public.missions
  drop column is_active;

-- ============================================================================
-- Comments
-- ============================================================================
comment on column public.trainings.publication_status is
  'Publication lifecycle: pending (submitted, awaiting approval) → live (visible to players) → archived (retired)';

comment on column public.training_activity_groups.publication_status is
  'Publication lifecycle: pending (submitted, awaiting approval) → live (visible to players) → archived (retired)';

comment on column public.training_activities.publication_status is
  'Publication lifecycle: pending (submitted, awaiting approval) → live (visible to players) → archived (retired)';

comment on column public.missions.publication_status is
  'Publication lifecycle: pending (submitted, awaiting approval) → live (visible to players) → archived (retired)';
