-- Migration: add activity_group_id to content_drafts
-- Links a draft to the activity group it will be published into.
-- Nullable — missions and ungrouped activities don't require a group.

set search_path = public;

alter table public.content_drafts
  add column if not exists activity_group_id uuid
    references public.training_activity_groups(id) on delete set null;

create index if not exists idx_content_drafts_group
  on public.content_drafts(activity_group_id);
