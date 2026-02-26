-- Thinkertools 2 hackathon seed data
-- Run this after schema.sql.

begin;

set search_path = public;

-- Reset demo data so reseeding replaces existing content deterministically.
truncate table
  public.ai_runs,
  public.event_log,
  public.comments,
  public.woi_turns,
  public.woi_game_ai_profiles,
  public.woi_games,
  public.woi_template_levels,
  public.woi_template_moves,
  public.woi_template_rules,
  public.woi_templates,
  public.quipx_reflections,
  public.quipx_discuss_entries,
  public.quipx_sessions,
  public.quipx_improve_strategies,
  public.quipx_reflect_responses,
  public.quipx_reflect_items,
  public.team_members,
  public.teams,
  public.users
restart identity cascade;

-- ----------
-- Users
-- ----------
insert into public.users (id, username, name, email, color)
values
  ('11111111-1111-4111-8111-111111111111', 'avery.agenda', 'Avery Agenda', 'avery@demo.local', '#1f2937'),
  ('22222222-2222-4222-8222-222222222222', 'rico.receipts', 'Rico Receipts', 'rico@demo.local', '#0f766e'),
  ('33333333-3333-4333-8333-333333333333', 'tess.tradeoff', 'Tess Tradeoff', 'tess@demo.local', '#7c2d12'),
  ('44444444-4444-4444-8444-444444444444', 'piper.patch', 'Piper Patch', 'piper@demo.local', '#312e81'),
  ('55555555-5555-4555-8555-555555555555', 'jules.judge', 'Jules Judge', 'jules@demo.local', '#4b5563')
on conflict (id) do update
set username = excluded.username,
    name = excluded.name,
    email = excluded.email,
    color = excluded.color;

-- ----------
-- Teams + members
-- ----------
insert into public.teams (id, name)
values
  ('10000000-0000-4000-8000-000000000001', 'Heatwave Response Lab'),
  ('10000000-0000-4000-8000-000000000002', 'Launchpad Discovery Crew')
on conflict (id) do update
set name = excluded.name;

insert into public.team_members (id, team_id, user_id, role)
values
  ('21000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'manager'),
  ('21000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'member'),
  ('21000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'member'),
  ('21000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'manager'),
  ('21000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002', '44444444-4444-4444-8444-444444444444', 'member'),
  ('21000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000002', '55555555-5555-4555-8555-555555555555', 'member')
on conflict (id) do update
set team_id = excluded.team_id,
    user_id = excluded.user_id,
    role = excluded.role;

-- ----------
-- Quipx master data
-- ----------
insert into public.quipx_reflect_items (id, label, short_text, long_text, order_index)
values
  ('30000000-0000-4000-8000-000000000001', 'Goal Clarity', 'The team understood the session goal.', 'The team had a shared understanding of the core question and what success looked like by the end of the session.', 1),
  ('30000000-0000-4000-8000-000000000002', 'Balanced Participation', 'Voices were balanced across participants.', 'Participation was distributed across team members, not dominated by one person.', 2),
  ('30000000-0000-4000-8000-000000000003', 'Evidence Quality', 'Claims were grounded in evidence.', 'The discussion used data, examples, and reasoning to support decisions.', 3),
  ('30000000-0000-4000-8000-000000000004', 'Constructive Dialogue', 'Debate remained respectful and useful.', 'The team challenged ideas productively while preserving trust and focus.', 4),
  ('30000000-0000-4000-8000-000000000005', 'Decision Confidence', 'The team left with clear next steps.', 'The session produced confident decisions and actionable follow-ups.', 5)
on conflict (id) do update
set label = excluded.label,
    short_text = excluded.short_text,
    long_text = excluded.long_text,
    order_index = excluded.order_index;

insert into public.quipx_reflect_responses (id, reflect_item_id, score, text)
select
  gen_random_uuid(),
  i.id,
  s.score,
  s.text
from public.quipx_reflect_items i
cross join (
  values
    (1, 'Major concern, this hurt collaboration.'),
    (2, 'Below target, needs immediate improvement.'),
    (3, 'Acceptable but inconsistent.'),
    (4, 'Strong outcome with minor gaps.'),
    (5, 'Excellent and repeatable practice.')
) as s(score, text)
on conflict (reflect_item_id, score) do update
set text = excluded.text;

insert into public.quipx_improve_strategies (id, reflect_response_id, strategy_text)
select
  gen_random_uuid(),
  rr.id,
  case rr.score
    when 1 then 'Run a 10-minute reset at the start: restate objective, define one measurable outcome, and assign a facilitator.'
    when 2 then 'Narrow scope to one decision and assign explicit speaking turns to increase signal and participation.'
    when 3 then 'Keep the current structure, but add a final 5-minute synthesis with owner and due date.'
    when 4 then 'Capture what worked as a repeatable checklist and rotate who leads each phase.'
    when 5 then 'Promote this pattern as a team standard and mentor another team through the same format.'
  end
from public.quipx_reflect_responses rr
where not exists (
  select 1
  from public.quipx_improve_strategies s
  where s.reflect_response_id = rr.id
);

-- ----------
-- Quipx session + activity
-- ----------
insert into public.quipx_sessions (
  id, team_id, creator_id, subject, objectives, starts_at, duration_min, status
)
values (
  '60000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'Which heat-fighting pilot should we fund before the city melts our slide deck?',
  'Pick two high-impact adaptation pilots, define decision criteria early, and assign one owner per validation task.',
  now() + interval '1 day',
  60,
  'active'
)
on conflict (id) do update
set team_id = excluded.team_id,
    creator_id = excluded.creator_id,
    subject = excluded.subject,
    objectives = excluded.objectives,
    starts_at = excluded.starts_at,
    duration_min = excluded.duration_min,
    status = excluded.status;

insert into public.quipx_discuss_entries (id, session_id, author_id, body_html, created_at)
values
  ('61000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '<p>Ground rule: no vibe-only picks. We score impact, feasibility, and learning value before any champion speech.</p>', now() - interval '35 minutes'),
  ('61000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', '<p>Transit shelter retrofits are boring in the best way: fast, measurable, and city-ready this quarter.</p>', now() - interval '30 minutes'),
  ('61000000-0000-4000-8000-000000000003', '60000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', '<p>One data-heavy pilot now prevents expensive guesswork later; confidence is a feature, not overhead.</p>', now() - interval '28 minutes')
on conflict (id) do update
set session_id = excluded.session_id,
    author_id = excluded.author_id,
    body_html = excluded.body_html,
    created_at = excluded.created_at;

insert into public.quipx_reflections (
  id, session_id, reflect_item_id, user_id, score, justification
)
select
  gen_random_uuid(),
  d.session_id,
  d.reflect_item_id,
  d.user_id,
  d.score,
  d.justification
from (
  values
    ('60000000-0000-4000-8000-000000000001'::uuid, '30000000-0000-4000-8000-000000000001'::uuid, '11111111-1111-4111-8111-111111111111'::uuid, 4::smallint, 'Question stayed focused and concrete.'),
    ('60000000-0000-4000-8000-000000000001'::uuid, '30000000-0000-4000-8000-000000000002'::uuid, '11111111-1111-4111-8111-111111111111'::uuid, 4::smallint, 'Everyone contributed, with minor imbalance early.'),
    ('60000000-0000-4000-8000-000000000001'::uuid, '30000000-0000-4000-8000-000000000003'::uuid, '11111111-1111-4111-8111-111111111111'::uuid, 5::smallint, 'Strong references to recent field data.'),
    ('60000000-0000-4000-8000-000000000001'::uuid, '30000000-0000-4000-8000-000000000004'::uuid, '11111111-1111-4111-8111-111111111111'::uuid, 4::smallint, 'Good challenge and respect balance.'),
    ('60000000-0000-4000-8000-000000000001'::uuid, '30000000-0000-4000-8000-000000000005'::uuid, '11111111-1111-4111-8111-111111111111'::uuid, 4::smallint, 'Next actions and owners are clear.'),

    ('60000000-0000-4000-8000-000000000001'::uuid, '30000000-0000-4000-8000-000000000001'::uuid, '22222222-2222-4222-8222-222222222222'::uuid, 3::smallint, 'Goal was clear after first 10 minutes.'),
    ('60000000-0000-4000-8000-000000000001'::uuid, '30000000-0000-4000-8000-000000000002'::uuid, '22222222-2222-4222-8222-222222222222'::uuid, 3::smallint, 'Two voices dominated the middle segment.'),
    ('60000000-0000-4000-8000-000000000001'::uuid, '30000000-0000-4000-8000-000000000003'::uuid, '22222222-2222-4222-8222-222222222222'::uuid, 4::smallint, 'Evidence quality was mostly strong.'),
    ('60000000-0000-4000-8000-000000000001'::uuid, '30000000-0000-4000-8000-000000000004'::uuid, '22222222-2222-4222-8222-222222222222'::uuid, 4::smallint, 'Debate stayed productive.'),
    ('60000000-0000-4000-8000-000000000001'::uuid, '30000000-0000-4000-8000-000000000005'::uuid, '22222222-2222-4222-8222-222222222222'::uuid, 3::smallint, 'Need tighter owner deadlines.'),

    ('60000000-0000-4000-8000-000000000001'::uuid, '30000000-0000-4000-8000-000000000001'::uuid, '33333333-3333-4333-8333-333333333333'::uuid, 2::smallint, 'Objective shifted once and cost time.'),
    ('60000000-0000-4000-8000-000000000001'::uuid, '30000000-0000-4000-8000-000000000002'::uuid, '33333333-3333-4333-8333-333333333333'::uuid, 3::smallint, 'Participation improved toward the end.'),
    ('60000000-0000-4000-8000-000000000001'::uuid, '30000000-0000-4000-8000-000000000003'::uuid, '33333333-3333-4333-8333-333333333333'::uuid, 4::smallint, 'Good data grounding overall.'),
    ('60000000-0000-4000-8000-000000000001'::uuid, '30000000-0000-4000-8000-000000000004'::uuid, '33333333-3333-4333-8333-333333333333'::uuid, 3::smallint, 'A few interruptions reduced clarity.'),
    ('60000000-0000-4000-8000-000000000001'::uuid, '30000000-0000-4000-8000-000000000005'::uuid, '33333333-3333-4333-8333-333333333333'::uuid, 2::smallint, 'Need stronger confidence before committing pilots.')
) as d(session_id, reflect_item_id, user_id, score, justification)
on conflict (session_id, reflect_item_id, user_id) do update
set score = excluded.score,
    justification = excluded.justification,
    updated_at = now();

-- ----------
-- WOI templates
-- ----------
insert into public.woi_templates (id, creator_id, name, objective, category, is_public)
values
  ('40000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Domino Map Inquiry', 'Map the chain of causes behind a target outcome and spotlight the few levers that move everything.', 'structural', true),
  ('40000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'Criteria Cage Match', 'Force competing options through one shared scorecard so recommendations survive daylight.', 'functional', true),
  ('40000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'Roadmap Tightrope Inquiry', 'Stage decisions over time and make every speed-vs-quality tradeoff explicit before execution.', 'process', false)
on conflict (id) do update
set creator_id = excluded.creator_id,
    name = excluded.name,
    objective = excluded.objective,
    category = excluded.category,
    is_public = excluded.is_public,
    updated_at = now();

insert into public.woi_template_rules (id, template_id, order_index, rule_text)
values
  ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 1, 'Each claim must cite observable evidence or a trusted source.'),
  ('41000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', 2, 'Every new node must connect to at least one existing node.'),
  ('41000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000001', 3, 'Flag assumptions separately from validated links.'),

  ('41000000-0000-4000-8000-000000000011', '40000000-0000-4000-8000-000000000002', 1, 'All options must be scored on the same criteria set.'),
  ('41000000-0000-4000-8000-000000000012', '40000000-0000-4000-8000-000000000002', 2, 'Criteria weights must be declared before final ranking.'),
  ('41000000-0000-4000-8000-000000000013', '40000000-0000-4000-8000-000000000002', 3, 'Final recommendation must include risk and mitigation.'),

  ('41000000-0000-4000-8000-000000000021', '40000000-0000-4000-8000-000000000003', 1, 'Each milestone must define an explicit acceptance condition.'),
  ('41000000-0000-4000-8000-000000000022', '40000000-0000-4000-8000-000000000003', 2, 'Tradeoffs must be documented with rationale.'),
  ('41000000-0000-4000-8000-000000000023', '40000000-0000-4000-8000-000000000003', 3, 'Ownership and deadline are required for each milestone.')
on conflict (id) do update
set template_id = excluded.template_id,
    order_index = excluded.order_index,
    rule_text = excluded.rule_text;

insert into public.woi_template_moves (id, template_id, order_index, move_text)
values
  ('42000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 1, 'Add causal node'),
  ('42000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', 2, 'Add evidence-backed link'),
  ('42000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000001', 3, 'Mark uncertain assumption'),

  ('42000000-0000-4000-8000-000000000011', '40000000-0000-4000-8000-000000000002', 1, 'Define criteria'),
  ('42000000-0000-4000-8000-000000000012', '40000000-0000-4000-8000-000000000002', 2, 'Score option'),
  ('42000000-0000-4000-8000-000000000013', '40000000-0000-4000-8000-000000000002', 3, 'Propose recommendation'),

  ('42000000-0000-4000-8000-000000000021', '40000000-0000-4000-8000-000000000003', 1, 'Create milestone'),
  ('42000000-0000-4000-8000-000000000022', '40000000-0000-4000-8000-000000000003', 2, 'Document tradeoff'),
  ('42000000-0000-4000-8000-000000000023', '40000000-0000-4000-8000-000000000003', 3, 'Assign owner and deadline')
on conflict (id) do update
set template_id = excluded.template_id,
    order_index = excluded.order_index,
    move_text = excluded.move_text;

insert into public.woi_template_levels (id, template_id, order_index, level_name, level_objective)
values
  ('43000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 1, 'Frame', 'Define target outcome and boundaries.'),
  ('43000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', 2, 'Map', 'Build and refine causal relationships.'),
  ('43000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000001', 3, 'Leverage', 'Identify highest-value intervention points.'),

  ('43000000-0000-4000-8000-000000000011', '40000000-0000-4000-8000-000000000002', 1, 'Criteria', 'Agree what success means.'),
  ('43000000-0000-4000-8000-000000000012', '40000000-0000-4000-8000-000000000002', 2, 'Recommendation', 'Score and rank options.'),

  ('43000000-0000-4000-8000-000000000021', '40000000-0000-4000-8000-000000000003', 1, 'Milestones', 'Draft timeline milestones.'),
  ('43000000-0000-4000-8000-000000000022', '40000000-0000-4000-8000-000000000003', 2, 'Tradeoffs', 'Evaluate scope, risk, and timing tradeoffs.'),
  ('43000000-0000-4000-8000-000000000023', '40000000-0000-4000-8000-000000000003', 3, 'Commit', 'Assign ownership and commit to dates.')
on conflict (id) do update
set template_id = excluded.template_id,
    order_index = excluded.order_index,
    level_name = excluded.level_name,
    level_objective = excluded.level_objective;

-- ----------
-- WOI games + turns
-- ----------
insert into public.woi_games (
  id, template_id, team_id, creator_id, question, description, is_public, status, current_player_id
)
values
  (
    '50000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'How do we keep people cool without burning the budget (or patience)?',
    'Map heat-risk drivers, choose the highest-leverage interventions, and commit to near-term execution owners.',
    true,
    'reflect',
    '22222222-2222-4222-8222-222222222222'
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000002',
    '11111111-1111-4111-8111-111111111111',
    'Which experiments deserve runway before Q3 turns into Q-why?',
    'Build a milestone plan that makes speed, quality, and confidence tradeoffs painfully explicit.',
    false,
    'in_play',
    '44444444-4444-4444-8444-444444444444'
  )
on conflict (id) do update
set template_id = excluded.template_id,
    team_id = excluded.team_id,
    creator_id = excluded.creator_id,
    question = excluded.question,
    description = excluded.description,
    is_public = excluded.is_public,
    status = excluded.status,
    current_player_id = excluded.current_player_id,
    updated_at = now();

insert into public.woi_turns (
  id, game_id, level_index, player_id, move_id, rule_id, content_html, created_at
)
values
  (
    '70000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    1,
    '11111111-1111-4111-8111-111111111111',
    '42000000-0000-4000-8000-000000000001',
    '41000000-0000-4000-8000-000000000001',
    '<p>Target outcome: reduce heat-related ER admissions by 20% in high-risk districts this summer.</p>',
    now() - interval '2 days'
  ),
  (
    '70000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000001',
    2,
    '22222222-2222-4222-8222-222222222222',
    '42000000-0000-4000-8000-000000000002',
    '41000000-0000-4000-8000-000000000002',
    '<p>Linked intervention: transit shelter retrofits reduce direct heat exposure for daily commuters.</p>',
    now() - interval '47 hours'
  ),
  (
    '70000000-0000-4000-8000-000000000003',
    '50000000-0000-4000-8000-000000000001',
    3,
    '33333333-3333-4333-8333-333333333333',
    '42000000-0000-4000-8000-000000000003',
    '41000000-0000-4000-8000-000000000003',
    '<p>Assumption flagged: outreach campaigns alone may underperform without transport schedule alignment.</p>',
    now() - interval '45 hours'
  ),
  (
    '70000000-0000-4000-8000-000000000011',
    '50000000-0000-4000-8000-000000000002',
    1,
    '44444444-4444-4444-8444-444444444444',
    '42000000-0000-4000-8000-000000000021',
    '41000000-0000-4000-8000-000000000021',
    '<p>Milestone 1: lock experiment hypotheses and instrumentation spec by Friday.</p>',
    now() - interval '6 hours'
  )
on conflict (id) do update
set game_id = excluded.game_id,
    level_index = excluded.level_index,
    player_id = excluded.player_id,
    move_id = excluded.move_id,
    rule_id = excluded.rule_id,
    content_html = excluded.content_html,
    created_at = excluded.created_at;

-- ----------
-- Comments
-- ----------
insert into public.comments (id, context_type, context_id, author_id, body, created_at)
values
  ('62000000-0000-4000-8000-000000000001', 'quipx_session', '60000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Next session starts with a two-minute scorecard recap and strict 90-second turns. No keynote monologues.', now() - interval '20 minutes'),
  ('62000000-0000-4000-8000-000000000002', 'woi_game', '50000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Great map. Quantify uncertainty on two links before we declare victory in front of judges.', now() - interval '18 minutes')
on conflict (id) do update
set context_type = excluded.context_type,
    context_id = excluded.context_id,
    author_id = excluded.author_id,
    body = excluded.body,
    created_at = excluded.created_at;

-- ----------
-- Instrumentation samples
-- ----------
insert into public.event_log (id, request_id, actor_id, event_name, entity_type, entity_id, metadata, created_at)
values
  (
    '80000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'session_created',
    'quipx_session',
    '60000000-0000-4000-8000-000000000001',
    '{"source":"seed","team":"Heatwave Response Lab"}'::jsonb,
    now() - interval '1 hour'
  ),
  (
    '80000000-0000-4000-8000-000000000002',
    '90000000-0000-4000-8000-000000000002',
    '22222222-2222-4222-8222-222222222222',
    'turn_submitted',
    'woi_game',
    '50000000-0000-4000-8000-000000000001',
    '{"level":2,"move":"Add evidence-backed link"}'::jsonb,
    now() - interval '50 minutes'
  )
on conflict (id) do update
set request_id = excluded.request_id,
    actor_id = excluded.actor_id,
    event_name = excluded.event_name,
    entity_type = excluded.entity_type,
    entity_id = excluded.entity_id,
    metadata = excluded.metadata,
    created_at = excluded.created_at;

insert into public.ai_runs (
  id, request_id, feature, model, status, input_tokens, output_tokens, latency_ms,
  prompt_preview, response_preview, error_text, created_by, created_at
)
values
  (
    '81000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000010',
    'template_generation',
    'gpt-5-mini',
    'success',
    820,
    410,
    1860,
    'Generate a process template for a city heat-response planning game.',
    'Returned objective plus 3 rules, 3 moves, and 3 levels with clear facilitation flow.',
    '',
    '11111111-1111-4111-8111-111111111111',
    now() - interval '40 minutes'
  ),
  (
    '81000000-0000-4000-8000-000000000002',
    '90000000-0000-4000-8000-000000000011',
    'turn_assist',
    'gpt-5-mini',
    'success',
    460,
    220,
    980,
    'Rewrite this turn to be tighter, clearer, and evidence-first.',
    'Returned a concise revision with evidence hooks and citation placeholders.',
    '',
    '22222222-2222-4222-8222-222222222222',
    now() - interval '35 minutes'
  )
on conflict (id) do update
set request_id = excluded.request_id,
    feature = excluded.feature,
    model = excluded.model,
    status = excluded.status,
    input_tokens = excluded.input_tokens,
    output_tokens = excluded.output_tokens,
    latency_ms = excluded.latency_ms,
    prompt_preview = excluded.prompt_preview,
    response_preview = excluded.response_preview,
    error_text = excluded.error_text,
    created_by = excluded.created_by,
    created_at = excluded.created_at;

commit;
