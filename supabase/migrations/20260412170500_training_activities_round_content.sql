-- ThinkerTools Quests: add authored round payload field for training activities.

set search_path = public;

alter table public.training_activities
  add column if not exists round_content jsonb not null default '{}'::jsonb;
