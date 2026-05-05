# ThinkerTools Quests Domain Foundation (Task 1)

## Scope
This implementation adds only reusable backend/domain scaffolding for the first playable ThinkerTools Quests slice.

Included:
- skills
- activities
- quests
- user skill progress
- activity completions
- quest completions
- progression utilities
- constrained typed-input matcher utilities

Explicitly not included:
- contradiction round flow
- quest stage flow
- dashboard/activity/quest UI
- challenge system
- AI tooling, creator tooling, or community systems

## Data model
Database objects are namespaced with the `quests_` prefix to avoid confusion with legacy systems.

Tables:
- `quests_skills`
- `quests_activities`
- `quests_quests`
- `quests_user_skill_progress`
- `quests_activity_completions`
- `quests_quest_completions`

Notes:
- `quests_skills` seeds `philosophical-reasoning` as the only active path for this slice.
- `quests_activities.content_type` is locked to `drill`.
- `quests_quests.content_type` is locked to `quest`.
- Level cap is encoded at schema and utility levels as 20.
- `quests_quest_completions` enforces one completion record per user/quest in this slice.

Files:
- `supabase/migrations/20260412163000_quests_domain_foundation.sql`
- `supabase/migrations/20260412170500_quests_activities_round_content.sql`

## Authored round payload (`round_content`)
`quests_activities.round_content` is a JSON payload for authored drill-round content.

Intended Contradiction Spotting shape:

```json
{
  "prompt_claims": [
    "A: It is always wrong to break the rules.",
    "C: Sometimes breaking a rule is justified to prevent serious harm."
  ],
  "question_text": "Which two claims are in strongest contradiction?",
  "correct_answer_labels": ["A", "C"],
  "explanation": "Claim A is absolute, while claim C permits a justified exception.",
  "round_type": "direct_claim_conflict"
}
```

Example row usage:

```sql
insert into public.quests_activities (
  slug,
  title,
  primary_skill_id,
  content_type,
  template_family,
  short_description,
  difficulty_label,
  completion_criteria,
  xp_reward,
  recommended_level_min,
  recommended_level_max,
  overlevel_grace_levels,
  round_content
)
values (
  'philo-contradiction-direct-001',
  'Contradiction Spotting: Direct Claims 1',
  '<philosophical-reasoning-skill-uuid>',
  'drill',
  'contradiction-spotting',
  'Identify the strongest contradiction between labeled claims.',
  'intro',
  'Select the two labels in strongest contradiction.',
  10,
  1,
  3,
  2,
  '{
    "prompt_claims": [
      "A: It is always wrong to break the rules.",
      "B: Rules should guide fair cooperation.",
      "C: Sometimes breaking a rule is justified to prevent serious harm.",
      "D: Trust depends on predictable rule enforcement."
    ],
    "question_text": "Which two claims are in strongest contradiction?",
    "correct_answer_labels": ["A", "C"],
    "explanation": "A forbids all exceptions; C permits an exception for serious harm.",
    "round_type": "direct_claim_conflict"
  }'::jsonb
);
```

## TypeScript domain layer
Files:
- `lib/quests/domain-types.ts`
- `lib/quests/progression.ts`
- `lib/quests/constrained-matcher.ts`
- `lib/quests/index.ts`

## Progression assumptions
- Locked XP table is implemented for level transitions 1→20.
- Overlevel decay is implemented for repeatable activities (drills):
  - full XP at or below recommended max level
  - 50% XP for the next 2 levels
  - 0 XP after that
- Quest completion currently awards full configured XP.
- XP award is floored for fractional results (example: 10 * 0.5 = 5).

## Constrained matcher assumptions
- Matcher is intentionally narrow and option-label driven.
- It supports:
  - case/spacing normalization
  - `&` to `and`
  - comma-separated forms (for example `A,C`)
  - simple wrappers (for example `claims A and C`)
- Invalid typed input returns `invalid_input` with a recoverable prompt message and is not auto-graded as philosophically wrong.

## What later threads can build on
- Contradiction Spotting can reuse `quests_activities` + `quests_activity_completions` + matcher.
- The Wrong Recruit can reuse `quests_quests` + `quests_quest_completions` + matcher.
- Shared XP and level logic can be reused by both drills and quest completion handling.

## Real blockers / ambiguities found
No true blockers for this task.

Non-blocking ambiguity resolved for this slice:
- Source docs mention a broader spectrum including `challenge`, but this task explicitly constrained active content types to `drill` and `quest`. The schema and domain code follow this task constraint.
