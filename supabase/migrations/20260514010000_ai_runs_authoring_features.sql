-- Migration: widen ai_runs.feature check constraint
-- Adds 'authoring_activity' and 'authoring_mission' to the allowed feature values
-- so the structured-AI client can log runs for the new authoring routes (Req 2.1).
-- Additive only — all existing allowed values are preserved.

set search_path = public;

alter table public.ai_runs
  drop constraint if exists ai_runs_feature_check;

alter table public.ai_runs
  add constraint ai_runs_feature_check
    check (feature in (
      'template_generation',
      'turn_assist',
      'summary',
      'other',
      'authoring_activity',
      'authoring_mission'
    ));
