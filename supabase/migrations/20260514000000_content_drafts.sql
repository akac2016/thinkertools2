-- Migration: content_drafts table
-- Stores activity and mission drafts in a draft/valid/published/archived lifecycle.
-- Draft content is never visible to learners until published into training_activities
-- or missions (Req 6.1, 6.2).

set search_path = public;

create table if not exists public.content_drafts (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('activity','mission')),
  status text not null default 'draft'
    check (status in ('draft','valid','published','archived')),
  origin text not null default 'manual'
    check (origin in ('manual','ai','co_authored')),
  primary_training_id uuid not null references public.trainings(id) on delete restrict,
  title text not null default '',
  slug text,
  body jsonb not null default '{}'::jsonb,
  validation_issues jsonb not null default '[]'::jsonb,
  ai_source text,
  ai_model text,
  published_ref_id uuid,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_content_drafts_creator_updated
  on public.content_drafts(created_by, updated_at desc);
