-- ThinkerTools Quests: add authored round payload field for drill rounds.

set search_path = public;

alter table public.quests_activities
  add column if not exists round_content jsonb not null default '{}'::jsonb;
