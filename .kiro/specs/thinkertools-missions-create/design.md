# Design Document

## Overview

This design implements ThinkerTools Missions Create: an educator authoring experience for
creating activity and mission **drafts** (manually, AI-assisted, or co-authored),
validating them, previewing them at a stable URL while unpublished, and publishing them so
learners can play them. It also generalizes contradiction grading to support a variable
number of correct answers.

The design is grounded in the existing codebase and is deliberately **verification-aware**:
the draft lifecycle and the playable-by-URL preview are built as clean seams so a later
Kane CLI playtest phase can attach without rework. That verification phase is out of scope
here (see the requirements doc's future-phase note).

### A defining constraint discovered in the codebase

The two content types are at very different levels of "data-driven readiness," and the
design must respect this:

- **Activities are already data-driven.** `GET /api/thinkertools-missions/training/
  contradiction-spotting` reads `training_activities` rows from the database and renders
  them from the `round_content` JSONB column. The submit route grades from that same
  `round_content`. Authoring an activity therefore means *writing a row* — the runtime
  already supports arbitrary data.
- **Missions are code-defined.** The full mission (stages, actions, character claims,
  contradiction review, resolution options, debrief) lives in
  `lib/missions/wrong-recruit.ts` as a `MissionDefinition` constant. The `missions` table
  is only a **catalog mirror** (`upsertMissionCatalogEntry` copies metadata into it) and
  has **no column that stores the mission body**. The play/complete route
  (`/api/thinkertools-missions/missions/[missionSlug]/complete`) is hardcoded: it rejects
  any slug that is not `wrongRecruitMission.slug` and grades against constants from the
  code definition.

Consequence: **activity authoring is achievable by writing rows directly; mission authoring
additionally needs a small migration (a `mission_body` column + a backfill of the existing
mission) plus a bounded refactor of the one currently single-mission grade/render path.**
The migration handles storage; the refactor makes the runtime read that stored body instead
of the imported `wrongRecruitMission` constant. Both content types are covered; the
implementation is sequenced so the activity path lands first, then the mission migration +
route refactor.

## Architecture

### High-level flow

```
                          ┌─────────────────────────────────────────┐
                          │          Authoring UI (educator)         │
                          │  manual form  +  optional "draft with AI" │
                          └───────────────┬───────────────┬──────────┘
                                          │               │
                         manual/edit save │               │ NL description
                                          ▼               ▼
                          ┌───────────────────────┐  ┌──────────────────────┐
                          │  POST /authoring/drafts │  │ POST /authoring/draft │
                          │  (create / update)      │  │      /generate        │
                          │                         │  │ runStructuredAi(...)  │
                          └───────────┬─────────────┘  └───────────┬──────────┘
                                      │                            │ draft fields
                                      │  validate (zod + graph)    │ (editable)
                                      ▼                            │
                          ┌───────────────────────┐                │
                          │  content_drafts table   │◄──────────────┘
                          │  (status, origin, body) │
                          └───────────┬─────────────┘
                          preview      │      publish (requires valid)
                          ▼            │            ▼
        ┌──────────────────────────┐  │  ┌──────────────────────────────────┐
        │ GET /authoring/drafts/:id │  │  │ POST /authoring/drafts/:id/publish│
        │ /play  (renders as learner│  │  │  → writes training_activities or  │
        │  but awards no XP)        │  │  │    missions row, is_active=true   │
        └──────────────────────────┘  │  └──────────────────────────────────┘
                                       ▼
                          (future) Kane plays the preview URL
```

### Where new code lives

```
app/
  thinkertools-missions-create/
    page.tsx                      # authoring entry (list + create)
    drafts/[draftId]/page.tsx     # editor + review/approve
    drafts/[draftId]/play/page.tsx# playable preview (learner-identical render)
  api/
    thinkertools-missions-create/
      drafts/route.ts             # GET list, POST create (manual)
      drafts/[draftId]/route.ts   # GET / PATCH (edit) / DELETE
      drafts/[draftId]/generate/route.ts  # AI single-shot draft of fields
      drafts/[draftId]/refine/route.ts    # AI conversational refinement of a draft
      drafts/[draftId]/publish/route.ts   # validate + publish

lib/
  authoring/
    draft-types.ts                # ContentDraft, DraftStatus, DraftOrigin
    activity-schema.ts            # zod schema for activity round_content (+ cardinality)
    mission-schema.ts             # zod schema for mission body
    validation.ts                 # schema + graph validation, returns issue list
    ai-prompts.ts                 # system/user prompt builders for drafting
    server.ts                     # draft CRUD, publish (insert into live tables)

components/
  thinkertools-missions-create/
    draft-list.tsx
    activity-editor.tsx
    mission-editor.tsx
    draft-source-badge.tsx        # shows live-model vs fallback (Req 2.4)

supabase/migrations/
  <ts>_content_drafts.sql                 # new content_drafts table
  <ts>_training_activities_cardinality.sql# expected_answer_count via round_content
  <ts>_missions_body_column.sql           # mission_body jsonb + wrong-recruit backfill
```

### Reuse of existing infrastructure

- **AI**: `runStructuredAi` from `lib/ai/client.ts` — already does schema-constrained
  OpenAI calls with a deterministic mock fallback and `ai_runs` logging. We add new feature
  tags to `aiFeatureSchema` and extend the `ai_runs.feature` check constraint.
- **Auth**: `requireActorIdFromRequest` from `lib/auth/actor.ts` for all authoring routes.
- **Grading helpers**: `lib/quests/contradiction-spotting.ts` and `constrained-matcher.ts`
  — reused and generalized for cardinality.
- **HTTP**: `jsonError` / `jsonSuccess` and `parseBody` patterns, unchanged.

## Data Models

### `content_drafts` (new table)

A single table holds drafts for both content types. The draft body is JSONB so the same
table serves activities and missions; validation interprets it per `content_type`.

```sql
create table if not exists public.content_drafts (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('activity','mission')),
  status text not null default 'draft'
    check (status in ('draft','valid','published','archived')),
  origin text not null default 'manual'
    check (origin in ('manual','ai','co_authored')),
  primary_training_id uuid not null references public.trainings(id) on delete restrict,
  title text not null default '',
  slug text,                       -- assigned at publish; unique among published
  body jsonb not null default '{}'::jsonb,   -- round_content (activity) or mission body
  validation_issues jsonb not null default '[]'::jsonb,
  ai_source text,                  -- 'openai' | 'mock' | null  (Req 2.3/2.4)
  ai_model text,
  published_ref_id uuid,           -- id of the row created in the live table on publish
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_content_drafts_creator_updated
  on public.content_drafts(created_by, updated_at desc);
```

`status` lifecycle: `draft` → (passes validation) `valid` → (publish) `published`. Editing a
`published` draft returns it to `draft` (Req 6.5). `archived` is for soft-deletes.

`origin` records authorship (Req 1.6); it is set to `manual` on hand-edit, `ai` on a clean
AI generation, and promoted to `co_authored` when an AI draft is subsequently hand-edited.

### Draft domain types — `lib/authoring/draft-types.ts`

```ts
export type DraftStatus = "draft" | "valid" | "published" | "archived";
export type DraftOrigin = "manual" | "ai" | "co_authored";
export type DraftContentType = "activity" | "mission";

export type ValidationIssue = { path: string; code: string; message: string };

export type ContentDraft = {
  id: string;
  contentType: DraftContentType;
  status: DraftStatus;
  origin: DraftOrigin;
  primaryTrainingId: string;
  title: string;
  slug: string | null;
  body: unknown;                 // validated per contentType
  validationIssues: ValidationIssue[];
  aiSource: "openai" | "mock" | null;
  aiModel: string | null;
  publishedRefId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};
```

### Activity schema + cardinality — `lib/authoring/activity-schema.ts`

The activity body extends the existing `round_content` shape with an explicit
`expected_answer_count`, defaulting to 2 for backward compatibility.

```ts
export const SUPPORTED_ANSWER_COUNTS = [1, 2] as const;

export const activityBodySchema = z.object({
  round_type: z.string().trim().min(1).default("activity_standard"),
  question_text: z.string().trim().min(1).max(300),
  prompt_claims: z.array(z.string().trim().min(1).max(300)).min(2).max(8),
  correct_answer_labels: z.array(z.string().trim().min(1).max(16)).min(1).max(2),
  explanation: z.string().trim().min(1).max(600),
  expected_answer_count: z.number().int().min(1).max(2).default(2),
}).strict()
  .refine(b => b.correct_answer_labels.length === b.expected_answer_count,
    { path: ["correct_answer_labels"], message: "Correct labels must match expected count" });
// + cross-field refinement: every correct label resolves to a prompt-claim label
```

### The cardinality patch (Requirement 5)

The grading core already generalizes — `isMatchingLabelPair` compares by length then sorted
equality, so it grades 1 or 2 equally well. Only three edge sites hardcode `2`:

1. **Submit route config guard** —
   `app/api/thinkertools-missions/training/contradiction-spotting/submit/route.ts`:
   ```ts
   // before
   if (visibleLabels.length < 2 || correctAnswerLabels.length !== 2) { ...misconfigured }
   // after — derive the expected count from round_content (default 2)
   const expectedCount = extractExpectedAnswerCount(activityData.round_content); // 1 or 2
   if (visibleLabels.length < expectedCount
       || correctAnswerLabels.length !== expectedCount) { ...misconfigured }
   ```
2. **Submit request schema** — `selectedLabels` max is raised to 2 generally; the exact
   count is enforced against `expectedCount` at runtime (so a 1-answer round rejects a
   2-label submission with the existing recoverable `MISSIONS_SELECTION_REQUIRED` error).
3. **Typed-answer matcher** — pass `expectedSelectionCount: expectedCount` (already
   supported by `matchConstrainedTypedInput`) instead of the implicit 2; and use the
   authored `question_text` rather than the two-claim default.

New helper in `lib/quests/contradiction-spotting.ts`:
```ts
export function extractExpectedAnswerCount(rc: TrainingActivityRoundContent): number {
  const n = typeof rc.expected_answer_count === "number" ? rc.expected_answer_count : 2;
  return n === 1 || n === 2 ? n : 2;   // out-of-range handled as misconfig at the guard
}
```
Backward compatibility (Req 5.4): existing rows have no `expected_answer_count`, so the
helper returns 2 and behavior is unchanged. `isMatchingLabelPair` is left as-is (it already
works for any count); only its misleading name is noted, not renamed, to avoid churn.

The single-selection UI affordance (Req 5.5) is handled in the contradiction round
component by reading `expected_answer_count` and switching between single-select and
pick-two interaction + adjusting the prompt copy.

## Components and Interfaces

### Mission storage + the bounded route refactor — `lib/authoring/mission-schema.ts`

The mission body mirrors `MissionDefinition` (minus runtime-only concerns):

```ts
export const missionBodySchema = z.object({
  narrative_hook: z.string().trim().min(1),
  short_description: z.string().trim().min(1),
  difficulty_label: z.string().trim().min(1),
  required_training_level: z.number().int().min(1).max(20),
  xp_reward: z.number().int().min(0),
  stages: z.array(missionStageSchema).min(2),
  actions: z.array(missionActionSchema).min(1),
  facts: z.array(missionFactSchema),
  character_claims: z.array(missionClaimSchema).min(2),
  contradiction_review: contradictionReviewSchema,
  resolution_options: z.array(resolutionOptionSchema).min(2),
  resolution_review: resolutionReviewSchema,
  debrief: debriefSchema,
}).strict();
```

Making missions authorable is **a small migration plus a bounded refactor of one route** —
not a large runtime rewrite. Three pieces:

**1. Migration: storage + backfill (straightforward SQL).** Add the body column and seed the
one existing mission so the data-driven path is proven against known-good content:

```sql
-- supabase/migrations/<ts>_missions_body_column.sql
set search_path = public;

alter table public.missions
  add column if not exists mission_body jsonb not null default '{}'::jsonb;

-- Backfill the canonical wrong-recruit mission body so the existing mission
-- works through the data-driven path unchanged. The JSON below mirrors
-- lib/missions/wrong-recruit.ts (stages, actions, claims, reviews, debrief).
update public.missions
set mission_body = '{ ...wrong-recruit definition as JSON... }'::jsonb
where slug = 'wrong-recruit'
  and mission_body = '{}'::jsonb;
```

This part matches the project's existing migration style (the rename migration already does
conditional `do $$` backfills) and is low-risk: additive column with a default, plus a
single targeted `update`.

**2. Refactor the grade/complete route (the real work, but bounded).**
`app/api/thinkertools-missions/missions/[missionSlug]/complete/route.ts` is currently
single-mission and code-bound:

```ts
// before — hardcoded to one slug, grades against imported constants
if (params.missionSlug !== wrongRecruitMission.slug) {
  return jsonError("Mission not found", { status: 404, code: "MISSIONS_NOT_FOUND" });
}
// ...isMatchingLabelPair(selected, wrongRecruitMission.contradictionReview.correctClaimLabels)
// ...parsedBody.data.selectedResolutionId !== wrongRecruitMission.resolutionReview.bestOptionId
```

After: load the `missions` row by slug, parse `mission_body`, and grade against *that*:

```ts
// after — load by slug, grade against stored mission_body
const mission = await loadActiveMissionBySlug(params.missionSlug);   // new loader
if (!mission) return jsonError("Mission not found", { status: 404, ... });

const body = missionBodySchema.parse(mission.mission_body);
const correctLabels = body.contradiction_review.correct_claim_labels;
const bestOptionId  = body.resolution_review.best_option_id;
if (!isMatchingLabelPair(selectedContradictionLabels, correctLabels)) { ...422 }
if (parsedBody.data.selectedResolutionId !== bestOptionId) { ...422 }
```

The grading helpers (`isMatchingLabelPair`, `normalizeLabelSelection`), the XP/level
update, the replay handling, and the completion-metadata shape are **all reused unchanged**
— only the *source* of the correct answers moves from the imported constant to the loaded
row. Because wrong-recruit is backfilled (piece 1), its behavior is identical after the
refactor, which is the regression guarantee.

**3. Refactor the mission render/play path** to load `mission_body` by slug instead of
importing `wrongRecruitMission`. Same pattern: one loader, render from data.

A shared loader keeps both routes consistent:

```ts
// lib/missions/server.ts
export async function loadActiveMissionBySlug(slug: string):
  Promise<{ id: string; slug: string; mission_body: unknown } | null>
```

The existing `wrongRecruitMission` constant is retained as the seed source for the backfill
(and as a typed reference), so nothing is deleted — the runtime simply stops reading from it
directly.

### Validation — `lib/authoring/validation.ts` (Requirement 4)

```ts
export function validateDraft(contentType, body): ValidationIssue[]
```

- **Activity** (Req 4.1): zod parse of `activityBodySchema`; plus unique claim labels and
  every `correct_answer_labels` entry resolves to an existing claim. Label resolution
  reuses the existing `parsePromptClaim` / label-normalization logic.
- **Mission** (Req 4.2): zod parse of `missionBodySchema`; plus a **graph reachability
  check** — build a directed graph from `actions[].targetStageId`, confirm a path exists
  from the first stage to a stage whose action `kind` is `complete` (the debrief), and that
  every `targetStageId` references a real stage. Also confirm contradiction/resolution
  reviews reference existing claims/options.

Validation runs on every create, edit, and AI generation; the resulting issue list is
stored in `content_drafts.validation_issues` and `status` is set to `valid` only when it is
empty. Publish is blocked unless `status === 'valid'` (Req 4.3, 6.3, 8.5).

> Note: the mission reachability check is intentionally the same property a future Kane
> playthrough would confirm in the live UI — static validation here, live verification
> later. No conflict; they are complementary layers.

### AI drafting — `lib/authoring/ai-prompts.ts` + generate/refine routes (Requirements 1, 2, 3)

The AI layer has **two modes**, both built on `runStructuredAi` and both producing a draft
body that conforms to the same content-type schema.

**Mode A — single-shot generation (Requirements 1, 2).**
`POST /api/thinkertools-missions-create/drafts/[draftId]/generate` accepts a natural-language
description and a target content type:

```ts
const result = await runStructuredAi({
  feature: "authoring_activity" | "authoring_mission",   // new AiFeature values
  schema: activityBodySchema | missionBodySchema,
  schemaName: "...",
  systemPrompt: buildAuthoringSystemPrompt(contentType, trainingContext),
  userPrompt: buildAuthoringUserPrompt(description),
  mockResponse: buildAuthoringMock(contentType, description),
  model: body.model,                 // optional override (Req 2.2)
  createdBy: actorId,
});
// persist result.output as draft body; record result.source ('openai'|'mock') and model
```

**Mode B — conversational refinement (Requirement 3).**
`POST /api/thinkertools-missions-create/drafts/[draftId]/refine` accepts a single
natural-language instruction and applies it to the *current* draft body:

```ts
const result = await runStructuredAi({
  feature: "authoring_activity" | "authoring_mission",   // same feature tags
  schema: activityBodySchema | missionBodySchema,        // same schema → output stays valid in shape
  schemaName: "...",
  systemPrompt: buildRefineSystemPrompt(contentType),    // "apply the instruction; preserve everything else"
  userPrompt: buildRefineUserPrompt(currentBody, instruction),  // current draft + the instruction
  mockResponse: currentBody,         // deterministic fallback: return the draft unchanged
  model: body.model,
  createdBy: actorId,
});
// the full revised body is returned (not a diff); persist it as the new draft state
```

Key design points for refinement:

- **Whole-object rewrite, schema-constrained.** The model returns the entire revised body,
  re-validated against the same schema, so a refined draft is never less valid in shape than
  a generated one (Req 3.2). "Preserve unaddressed parts" is enforced by prompt design
  (passing the current body and instructing minimal change), not by a diff protocol — this
  keeps the implementation within the existing structured-output client with no new
  machinery.
- **Cumulative turns are stateless on the server.** Each refine call reads the latest
  persisted draft body and writes the new one, so a sequence of instructions composes
  naturally without storing a chat transcript (Req 3.3). An optional `refinement_log`
  (jsonb array of `{instruction, at}`) may be appended to the draft for provenance, but the
  draft body itself is the single source of truth.
- **Ambiguous / inapplicable instruction.** If the model cannot apply the instruction (or
  the result fails schema validation), the route returns a recoverable 422 and leaves the
  stored draft unchanged (Req 3.4). The deterministic fallback (`mockResponse: currentBody`)
  means a missing API key degrades to "no change" rather than an error.
- **Manual and conversational editing interleave freely** — both write the same `body`
  column, so a teacher can refine by chat, then hand-edit a field, then refine again
  (Req 3.6).

Shared across both modes:

- `aiFeatureSchema` gains `"authoring_activity"` and `"authoring_mission"`; the
  `ai_runs.feature` check constraint is widened by migration to allow them (it currently
  also allows `'other'`).
- `result.source` and `result.model` are stored on the draft (`ai_source`, `ai_model`) so
  the UI can show whether the educator is reviewing a live-model draft or a deterministic
  fallback (Req 2.3, 2.4). A `mock` source surfaces a visible "fallback" badge.
- Any AI involvement sets `origin` to `ai` (clean generation) or `co_authored` (AI output
  later hand-edited, or a manual draft subsequently refined by AI) per Req 1.6 / 3.5.
- If a single-shot description is too thin to fill required fields, the structured output
  fails schema parse for the missing fields; the route returns a recoverable 422 listing the
  unfilled fields rather than persisting junk (Req 2.5).
- Generated/refined fields are written to the editable draft; any later hand-edit flips
  `origin` to `co_authored` (Req 1.5, 1.6).

### Playable-by-URL preview (Requirement 7)

`GET /thinkertools-missions-create/drafts/[draftId]/play` renders the draft through the same
presentation components learners use, sourced from the draft body rather than a published
row. Critically, **preview play does not award XP or record progress**:

- Preview submission calls a preview-scoped grading path that runs the same grading logic
  (so the experience is identical) but **does not** write `training_activity_attempts` /
  `mission_completions` or update `user_training_progress` (Req 7.3). Implementation: a
  `preview: true` branch that computes `wasCorrect` and returns the result object without
  the persistence writes.
- Access is gated by `requireActorIdFromRequest`; only the draft's `created_by` (or an
  authenticated educator) may open it. Unauthorized requests get 403 (Req 7.4).
- The stable address is the draft id (Req 7.1), which is also exactly what a future Kane run
  would target.

### Publish (Requirements 5, 7)

`POST /api/thinkertools-missions-create/drafts/[draftId]/publish`:

1. Re-validate; require `status === 'valid'` else 409 with issues (Req 6.3, 8.5).
2. Assign a unique `slug` (from title, de-duplicated against existing published slugs).
3. **Activity**: insert a `training_activities` row (`content_type='activity'`,
   `is_active=true`, `round_content = body`, level band + xp from the draft). Record the new
   row id in `published_ref_id`.
4. **Mission**: insert/upsert a `missions` row plus the new `mission_body`; `is_active=true`.
5. Set draft `status='published'`. The published content now appears in the existing learner
   listings, which already filter on `is_active=true` (Req 6.4).

Draft content never appears in learner listings because it lives in `content_drafts`, not in
`training_activities` / `missions`, until publish (Req 6.1, 6.2).

### Authorization model (hackathon-scoped)

There is no role/educator concept in the codebase today (only `team_members.role` for WOI,
unrelated here). For this release, an **"educator" is any authenticated actor**
(`requireActorIdFromRequest`), and authoring routes are scoped to drafts the actor created.
A real educator/admin role is explicitly deferred. This is called out so the security
posture is honest: publishing is gated by authentication and ownership, not by a privileged
role, and that is a known limitation for the hackathon scope.

## Error Handling

Follow the established `jsonError(code, {status, details})` convention. New codes:

| Code | Status | When |
|---|---|---|
| `AUTHORING_DRAFT_NOT_FOUND` | 404 | draft id missing |
| `AUTHORING_DRAFT_FORBIDDEN` | 403 | actor is not the draft owner |
| `AUTHORING_VALIDATION_FAILED` | 422 | schema/graph validation issues (returns issue list) |
| `AUTHORING_AI_INCOMPLETE` | 422 | NL description too vague to fill required fields |
| `AUTHORING_REFINE_INAPPLICABLE` | 422 | refinement instruction ambiguous/unapplicable; draft left unchanged |
| `AUTHORING_PUBLISH_NOT_VALID` | 409 | publish attempted on a non-`valid` draft |
| `AUTHORING_SLUG_CONFLICT` | 409 | generated slug collides and cannot be de-duplicated |

The AI path inherits `runStructuredAi`'s graceful fallback: an OpenAI failure yields a
deterministic mock with `source='mock'` rather than an error, surfaced to the educator as a
fallback badge instead of a hard failure.

## Testing Strategy

- **Unit (cardinality)**: `extractExpectedAnswerCount` (missing → 2, 1, 2, out-of-range → 2);
  `isMatchingLabelPair` for 1- and 2-element answers; submit-route guard accepts a correct
  1-answer submission and rejects a 2-label submission for a 1-answer round; existing
  2-answer rows unchanged (Req 5.4 regression).
- **Unit (validation)**: activity label-resolution failures; mission graph checks —
  unreachable debrief, dangling `targetStageId`, review referencing a missing claim.
- **Unit (AI mapping)**: structured output → draft body; vague description → incomplete
  error; `source`/`model` persisted.
- **Unit (AI refinement)**: instruction applied to a current body returns a schema-valid
  revised body; unaddressed fields preserved; inapplicable instruction → 422 with draft
  unchanged; cumulative turns compose.
- **Integration (lifecycle)**: create → validate → preview (no XP written) → publish →
  appears in learner listing; edit published → returns to draft.
- **Integration (mission parity)**: after the `mission_body` migration + route refactor,
  completing the backfilled wrong-recruit mission grades, awards XP, and records completion
  identically to the pre-refactor behavior (regression guard).
- **Manual**: author a 1-answer activity end-to-end and play it as a learner.

This is the natural seam where the future Kane phase plugs in: once a draft is playable by
URL, a Kane run can assert the same lifecycle outcomes (completable, renders, grades, awards
XP) against the live UI.

## Correctness Properties

These invariants must hold and are the basis for the tests above (and for the future Kane
verification phase):

### Property 1: Draft isolation

Content in `content_drafts` is never returned by any learner-facing listing or grading
path; only rows in `training_activities` / `missions` with `is_active=true` are playable for
credit.

**Validates: Requirements 6.1, 6.2**

### Property 2: Publish requires validity

A draft can reach `published` only after `validateDraft` returns zero issues. No invalid
content can be published.

**Validates: Requirements 4.3, 6.3, 8.5**

### Property 3: Cardinality consistency

For any activity, the number of correct answer labels, the declared `expected_answer_count`,
the accepted selection size, and the UI affordance all agree. Existing 2-answer rows (no
declared count) behave exactly as before.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

### Property 4: Mission completability

A mission draft is `valid` only if a path exists from the first stage to the debrief and
every action target references a real stage.

**Validates: Requirements 4.2**

### Property 5: Preview is side-effect-free

Playing a draft via its preview URL never writes attempts/completions or mutates
`user_training_progress`.

**Validates: Requirements 7.3**

### Property 6: Authorship honesty

`origin` reflects reality: `manual` when no AI was used, `ai` for unedited AI output,
`co_authored` once AI output is hand-edited; `ai_source` distinguishes live-model from
fallback drafts.

**Validates: Requirements 1.6, 2.3, 2.4, 3.5**

### Property 7: Wrong-recruit parity after the mission refactor

After missions are loaded from `mission_body` instead of the imported constant, the
backfilled wrong-recruit mission grades, awards XP, and records completion exactly as it did
before the refactor.

**Validates: Requirements 4.2, 6.4**

### Property 8: Refinement preserves validity and intent

A conversational refinement produces a body that still conforms to the content-type schema,
applies the requested change, and—when the instruction cannot be applied—leaves the stored
draft unchanged.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Design Decisions and Rationale

1. **Single `content_drafts` table with JSONB body** rather than separate draft tables, so
   one lifecycle/validation/preview/publish pipeline serves both content types and the
   schema mirrors the existing `round_content` JSONB approach.
2. **Activities first, missions second** — dictated by the codebase: activities are already
   data-driven (author = write a row), while missions need a small `mission_body` migration
   plus a bounded refactor of one grade/render path. Sequencing keeps a working demo at the
   first milestone without blocking on the mission route refactor.
3. **`expected_answer_count` defaulting to 2** — makes the cardinality change additive and
   backward-compatible, touching only three hardcoded edge sites while leaving the grading
   core (`isMatchingLabelPair`) untouched.
4. **Preview reuses learner rendering with a no-persist grading branch** — guarantees the
   preview is a faithful experience (so future Kane verification is meaningful) without
   corrupting educator progress.
5. **Draft id as the stable preview address** — gives any future automated verifier a clean,
   stable target with no extra addressing scheme.
6. **AI is an optional layer over a manual core** — manual authoring works with zero AI
   involvement; AI drafting writes into the same editable draft, preserving educator control
   and honest authorship attribution.
