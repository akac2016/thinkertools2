-- Ticket 10: read-only audit for prompt-derived activity-group and draft labels.
--
-- Run each query separately in the Supabase SQL editor. Every statement in
-- this file is SELECT-only. The heuristics deliberately over-report candidates
-- for human review; they are not cleanup instructions.

-- ---------------------------------------------------------------------------
-- Query 1: suspicious activity-group summary
-- ---------------------------------------------------------------------------

with activity_counts as (
  select
    activity_group_id,
    count(*) filter (where publication_status <> 'archived') as question_count,
    count(*) filter (where publication_status = 'pending') as pending_question_count,
    count(*) filter (where publication_status = 'live') as live_question_count
  from public.training_activities
  where activity_group_id is not null
  group by activity_group_id
),
draft_counts as (
  select
    activity_group_id,
    count(*) filter (where status <> 'archived') as draft_count,
    count(*) filter (where status = 'draft') as draft_status_count,
    count(*) filter (where status = 'valid') as valid_draft_count,
    count(*) filter (where status = 'published') as published_draft_count
  from public.content_drafts
  where content_type = 'activity'
    and activity_group_id is not null
  group by activity_group_id
),
group_metrics as (
  select
    g.id as group_id,
    g.training_id,
    t.title as training_title,
    g.slug as group_slug,
    g.title as group_title,
    g.description,
    g.template_family,
    g.publication_status as group_status,
    g.created_at,
    g.updated_at,
    regexp_replace(lower(trim(g.title)), '\s+', ' ', 'g') as normalized_title,
    count(*) over (
      partition by
        g.training_id,
        regexp_replace(lower(trim(g.title)), '\s+', ' ', 'g')
    ) as same_title_count_in_subject,
    coalesce(a.question_count, 0) as question_count,
    coalesce(a.pending_question_count, 0) as pending_question_count,
    coalesce(a.live_question_count, 0) as live_question_count,
    coalesce(d.draft_count, 0) as draft_count,
    coalesce(d.draft_status_count, 0) as draft_status_count,
    coalesce(d.valid_draft_count, 0) as valid_draft_count,
    coalesce(d.published_draft_count, 0) as published_draft_count
  from public.training_activity_groups g
  join public.trainings t on t.id = g.training_id
  left join activity_counts a on a.activity_group_id = g.id
  left join draft_counts d on d.activity_group_id = g.id
  where g.publication_status <> 'archived'
),
flagged as (
  select
    *,
    array_remove(array[
      case
        when normalized_title in (
          'new category',
          'new activity group',
          'new group',
          'untitled'
        ) then 'placeholder title'
      end,
      case
        when same_title_count_in_subject > 1 then 'duplicate title within subject'
      end,
      case
        when char_length(trim(group_title)) > 60 then 'unusually long title / possible prompt fragment'
      end,
      case
        when group_title ~ E'[?\n\r]' then 'question or multiline title / possible prompt fragment'
      end,
      case
        when group_status = 'pending'
          and question_count = 0
          and draft_count = 0
          then 'empty pending group'
      end
    ], null) as reasons
  from group_metrics
)
select
  case
    when group_status = 'live' or live_question_count > 0
      then 'PROTECT: learner-facing content'
    when published_draft_count > 0
      then 'CAUTION: linked to published draft'
    when question_count = 0 and draft_count = 0
      then 'REVIEW: empty candidate'
    else 'REVIEW: contains non-live content'
  end as safety_classification,
  array_to_string(reasons, '; ') as candidate_reasons,
  training_title,
  training_id,
  group_title,
  group_id,
  group_slug,
  group_status,
  same_title_count_in_subject,
  question_count,
  pending_question_count,
  live_question_count,
  draft_count,
  draft_status_count,
  valid_draft_count,
  published_draft_count,
  description,
  template_family,
  created_at,
  updated_at
from flagged
where cardinality(reasons) > 0
order by
  case
    when group_status = 'live' or live_question_count > 0 then 0
    when published_draft_count > 0 then 1
    else 2
  end,
  training_title,
  group_title,
  created_at;

-- ---------------------------------------------------------------------------
-- Query 2: suspicious activity-draft labels, including ungrouped drafts
-- ---------------------------------------------------------------------------

with draft_metrics as (
  select
    d.id as draft_id,
    d.primary_training_id as training_id,
    t.title as training_title,
    d.activity_group_id as group_id,
    g.title as group_title,
    d.title as draft_title,
    d.body ->> 'question_text' as question_text,
    d.status as draft_status,
    d.origin,
    d.published_ref_id,
    d.created_by,
    d.created_at,
    d.updated_at,
    regexp_replace(lower(trim(d.title)), '\s+', ' ', 'g') as normalized_title,
    regexp_replace(lower(trim(t.title)), '\s+', ' ', 'g') as normalized_training_title,
    count(*) over (
      partition by
        d.primary_training_id,
        regexp_replace(lower(trim(d.title)), '\s+', ' ', 'g')
    ) as same_title_count_in_subject
  from public.content_drafts d
  join public.trainings t on t.id = d.primary_training_id
  left join public.training_activity_groups g on g.id = d.activity_group_id
  where d.content_type = 'activity'
    and d.status <> 'archived'
),
flagged as (
  select
    *,
    array_remove(array[
      case
        when normalized_title in (
          '',
          'new category',
          'new activity group',
          'new group',
          'untitled'
        ) then 'blank or placeholder title'
      end,
      case
        when same_title_count_in_subject > 1
          and normalized_title = normalized_training_title
          then 'repeated generic subject title'
      end,
      case
        when same_title_count_in_subject > 1
          and normalized_title <> normalized_training_title
          then 'duplicate title within subject'
      end,
      case
        when char_length(trim(draft_title)) > 80 then 'unusually long title / possible prompt fragment'
      end,
      case
        when draft_title ~ E'[?\n\r]' then 'question or multiline title / possible prompt fragment'
      end,
      case
        when nullif(trim(question_text), '') is not null
          and normalized_title = regexp_replace(lower(trim(question_text)), '\s+', ' ', 'g')
          then 'title repeats full question text'
      end,
      case
        when nullif(trim(question_text), '') is null then 'missing question text / possibly empty draft'
      end
    ], null) as reasons
  from draft_metrics
)
select
  case
    when draft_status = 'published' or published_ref_id is not null
      then 'CAUTION: published or linked to published content'
    else 'REVIEW: draft-only content'
  end as safety_classification,
  array_to_string(reasons, '; ') as candidate_reasons,
  training_title,
  training_id,
  group_title,
  group_id,
  draft_title,
  draft_id,
  draft_status,
  origin,
  same_title_count_in_subject,
  question_text,
  published_ref_id,
  created_by,
  created_at,
  updated_at
from flagged
where cardinality(reasons) > 0
order by
  case when draft_status = 'published' or published_ref_id is not null then 0 else 1 end,
  training_title,
  draft_title,
  created_at;

-- ---------------------------------------------------------------------------
-- Query 3: full contents of every group flagged by Query 1
-- ---------------------------------------------------------------------------

with group_title_metrics as (
  select
    g.*,
    regexp_replace(lower(trim(g.title)), '\s+', ' ', 'g') as normalized_title,
    count(*) over (
      partition by
        g.training_id,
        regexp_replace(lower(trim(g.title)), '\s+', ' ', 'g')
    ) as same_title_count_in_subject
  from public.training_activity_groups g
  where g.publication_status <> 'archived'
),
candidate_groups as (
  select g.id
  from group_title_metrics g
  where g.normalized_title in (
      'new category',
      'new activity group',
      'new group',
      'untitled'
    )
    or g.same_title_count_in_subject > 1
    or char_length(trim(g.title)) > 60
    or g.title ~ E'[?\n\r]'
    or (
      g.publication_status = 'pending'
      and not exists (
        select 1
        from public.training_activities a
        where a.activity_group_id = g.id
          and a.publication_status <> 'archived'
      )
      and not exists (
        select 1
        from public.content_drafts d
        where d.activity_group_id = g.id
          and d.content_type = 'activity'
          and d.status <> 'archived'
      )
    )
),
contents as (
  select
    g.training_id,
    t.title as training_title,
    g.id as group_id,
    g.title as group_title,
    g.publication_status as group_status,
    'published_activity'::text as item_type,
    a.id as item_id,
    a.title as item_title,
    a.publication_status as item_status,
    a.round_content ->> 'question_text' as question_text,
    a.created_at,
    a.updated_at
  from candidate_groups c
  join public.training_activity_groups g on g.id = c.id
  join public.trainings t on t.id = g.training_id
  join public.training_activities a on a.activity_group_id = g.id

  union all

  select
    g.training_id,
    t.title as training_title,
    g.id as group_id,
    g.title as group_title,
    g.publication_status as group_status,
    'content_draft'::text as item_type,
    d.id as item_id,
    d.title as item_title,
    d.status as item_status,
    d.body ->> 'question_text' as question_text,
    d.created_at,
    d.updated_at
  from candidate_groups c
  join public.training_activity_groups g on g.id = c.id
  join public.trainings t on t.id = g.training_id
  join public.content_drafts d on d.activity_group_id = g.id
  where d.content_type = 'activity'
)
select *
from contents
order by training_title, group_title, item_type, item_status, created_at;
