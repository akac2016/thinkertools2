-- Migration: training_activity_groups
-- Adds a proper "activity group" entity that sits between a training and
-- individual training_activities rows. An activity group represents a named
-- skill or exercise type within a training (e.g. "Contradiction Spotting"
-- within "Philosophical Reasoning").
--
-- Backfills the 50 existing philosophical-reasoning rows by deriving groups
-- from their template_family values.

set search_path = public;

-- ── 1. Create the table ───────────────────────────────────────────────────────

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

-- ── 2. Add group_id FK to training_activities ─────────────────────────────────

alter table public.training_activities
  add column if not exists activity_group_id uuid
    references public.training_activity_groups(id) on delete set null;

create index if not exists idx_training_activities_group
  on public.training_activities(activity_group_id);

-- ── 3. Backfill: create groups from existing template_family values ───────────

do $$
declare
  v_training_id uuid;
begin
  select id into v_training_id
  from public.trainings
  where slug = 'philosophical-reasoning'
  limit 1;

  if v_training_id is null then
    return;
  end if;

  -- Insert the five groups derived from the seed data's template_family values
  insert into public.training_activity_groups
    (slug, title, description, training_id, template_family, display_order, is_active)
  values
    (
      'philo-contradiction-spotting',
      'Contradiction Spotting',
      'Identify which two claims in a set are in strongest contradiction with each other.',
      v_training_id,
      'contradiction_direct_claim_conflict',
      1,
      true
    ),
    (
      'philo-rule-vs-exception',
      'Rule vs. Exception',
      'Identify when a stated rule and a stated exception cannot both hold.',
      v_training_id,
      'contradiction_rule_versus_exception',
      2,
      true
    ),
    (
      'philo-principle-vs-action',
      'Principle vs. Action',
      'Identify when a stated principle and a described action are in direct conflict.',
      v_training_id,
      'contradiction_principle_versus_action',
      3,
      true
    ),
    (
      'philo-universal-vs-edge-case',
      'Universal vs. Edge Case',
      'Identify when a universal claim is undermined by a specific edge case.',
      v_training_id,
      'contradiction_universal_vs_edge_case',
      4,
      true
    ),
    (
      'philo-belief-set-incompatible',
      'Incompatible Belief Set',
      'Identify the pair of beliefs within a set that cannot both be held consistently.',
      v_training_id,
      'contradiction_belief_set_incompatible_pair',
      5,
      true
    )
  on conflict (slug) do update
    set
      title = excluded.title,
      description = excluded.description,
      template_family = excluded.template_family,
      display_order = excluded.display_order,
      updated_at = now();

  -- Assign each existing training_activity to its group via template_family
  update public.training_activities ta
  set activity_group_id = g.id
  from public.training_activity_groups g
  where g.training_id = v_training_id
    and g.template_family = ta.template_family
    and ta.primary_training_id = v_training_id
    and ta.activity_group_id is null;
end;
$$;
