# Implementation Plan

## Overview

The plan is sequenced so a working demo exists at the end of Milestone 1 (activity authoring,
end to end) and a second at the end of Milestone 2 (mission authoring). Each task lists the
requirements it implements. Tasks are incremental — every step builds on prior code and ends
in a wired, testable state. No automated Kane verification is built here (future phase); the
draft lifecycle and playable-by-URL preview are the seams it will later attach to.

## Task Dependency Graph

Tasks grouped into execution waves; tasks within a wave can proceed in parallel once their
dependencies are met. Phase 0 (cardinality) is independent and may run in any wave.

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1", "4"], "dependsOn": [] },
    { "wave": 2, "tasks": ["2", "5", "9"], "dependsOn": ["1", "4"] },
    { "wave": 3, "tasks": ["3", "6", "7", "10"], "dependsOn": ["2", "5", "9"] },
    { "wave": 4, "tasks": ["8", "11", "12"], "dependsOn": ["6", "7", "10"] },
    { "wave": 5, "tasks": ["13", "17"], "dependsOn": ["8", "11", "12"] },
    { "wave": 6, "tasks": ["14", "15", "18"], "dependsOn": ["3", "8", "13", "17"] },
    { "wave": 7, "tasks": ["16", "19"], "dependsOn": ["8", "15", "18"] },
    { "wave": 8, "tasks": ["20"], "dependsOn": ["14", "18"] },
    { "wave": 9, "tasks": ["21"], "dependsOn": ["16", "19", "20"] }
  ],
  "milestones": {
    "milestone_1_activities": ["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16"],
    "milestone_2_missions": ["17","18","19","20","21"]
  }
}
```

Critical path to Milestone 1: 4 → 5 → 6 → 8 → 11 → 12 → 14 → 15 → 16.
Critical path to Milestone 2: + 17 → 18 → 19 → 20 → 21. Phase 0 (1 → 2 → 3) runs in parallel.

## Tasks

### Phase 0 — Cardinality patch (independent, smallest)

- [x] 1. Add variable correct-answer support to the contradiction grading helpers
  - Add `extractExpectedAnswerCount(roundContent)` to `lib/quests/contradiction-spotting.ts`
    returning 1 or 2, defaulting to 2 when absent or out of range
  - Add unit tests: missing → 2, explicit 1, explicit 2, out-of-range → 2
  - Confirm `isMatchingLabelPair` already grades 1- and 2-element answers (add tests; do not
    rename)
  - _Requirements: 5.1, 5.4_

- [x] 2. Generalize the contradiction submit route to the declared answer count
  - In `app/api/thinkertools-missions/training/contradiction-spotting/submit/route.ts`,
    derive `expectedCount` from `round_content` and replace the hard-coded `!== 2` config
    guard with a check against it
  - Raise the request schema `selectedLabels` max to 2 and enforce the exact count against
    `expectedCount` at runtime, returning the existing recoverable selection error on mismatch
  - Pass `expectedSelectionCount: expectedCount` into `matchConstrainedTypedInput`
  - Add tests: a 1-answer round accepts a correct single selection and rejects a 2-label
    submission; existing 2-answer rounds unchanged
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 3. Reflect cardinality in the contradiction round UI
  - In the contradiction round component, read `expected_answer_count` and switch between
    single-select and pick-two interaction, adjusting the prompt copy accordingly
  - Default to pick-two when the field is absent (backward compatible)
  - _Requirements: 5.5_

### Phase 1 — Draft storage, types, and CRUD

- [x] 4. Create the `content_drafts` table migration
  - Add `supabase/migrations/<ts>_content_drafts.sql` per the design (columns: content_type,
    status, origin, primary_training_id, title, slug, body jsonb, validation_issues jsonb,
    ai_source, ai_model, published_ref_id, created_by, timestamps) with the status/origin
    check constraints and the creator/updated index
  - _Requirements: 1.7, 6.1, 6.2_

- [x] 5. Add draft domain types and a server data-access module
  - Create `lib/authoring/draft-types.ts` (`ContentDraft`, `DraftStatus`, `DraftOrigin`,
    `DraftContentType`, `ValidationIssue`)
  - Create `lib/authoring/server.ts` with create/read/update/list/archive helpers over
    `content_drafts` using `supabaseAdmin`, mapping rows to `ContentDraft`
  - _Requirements: 1.2, 1.6, 1.7_

- [x] 6. Implement draft CRUD API routes
  - `app/api/thinkertools-missions-create/drafts/route.ts`: GET (list caller's drafts),
    POST (create a manual draft from supplied fields, no AI required)
  - `app/api/thinkertools-missions-create/drafts/[draftId]/route.ts`: GET, PATCH (edit
    fields), DELETE (archive); gate all by `requireActorIdFromRequest` and draft ownership
  - On create/edit, set/maintain `origin` (`manual`; promote to `co_authored` if editing an
    AI draft) and store the draft in `draft` status
  - Return `AUTHORING_DRAFT_NOT_FOUND` / `AUTHORING_DRAFT_FORBIDDEN` as specified
  - _Requirements: 1.1, 1.2, 1.6, 1.7_

### Phase 2 — Validation

- [x] 7. Build the content schemas
  - Create `lib/authoring/activity-schema.ts` (`activityBodySchema` with
    `expected_answer_count` default 2 and the correct-label/claim cross-field refinements)
  - Create `lib/authoring/mission-schema.ts` (`missionBodySchema` mirroring
    `MissionDefinition`: stages, actions, claims, reviews, debrief)
  - _Requirements: 4.1, 4.2_

- [x] 8. Implement the validation module
  - Create `lib/authoring/validation.ts` exporting `validateDraft(contentType, body)`
  - Activity: zod parse + unique claim labels + every correct label resolves to a claim
    (reuse label-normalization from `contradiction-spotting.ts`)
  - Mission: zod parse + graph reachability (first stage → a `complete` action/debrief),
    no dangling `targetStageId`, reviews reference existing claims/options
  - Wire validation into create/edit so `validation_issues` is stored and `status` becomes
    `valid` only when empty
  - Add unit tests: activity label-resolution failures; mission unreachable-debrief,
    dangling target, review-references-missing-claim
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

### Phase 3 — AI drafting layer (single-shot + conversational)

- [x] 9. Register the new AI features
  - Add `authoring_activity` and `authoring_mission` to `aiFeatureSchema` in
    `lib/ai/schemas.ts`
  - Add a migration widening the `ai_runs.feature` check constraint to include the two new
    values
  - _Requirements: 2.1_

- [x] 10. Build the authoring prompt builders and deterministic mocks
  - Create `lib/authoring/ai-prompts.ts`: `buildAuthoringSystemPrompt`,
    `buildAuthoringUserPrompt`, `buildRefineSystemPrompt`, `buildRefineUserPrompt`
  - Add deterministic `buildAuthoringMock(contentType, description)` so the flow works with
    no API key (mirrors existing AI mock pattern)
  - _Requirements: 2.1, 2.3_

- [x] 11. Implement single-shot generation route
  - `app/api/thinkertools-missions-create/drafts/[draftId]/generate/route.ts`: accept a
    description + content type, call `runStructuredAi` with the matching schema, allow a
    `model` override, persist `result.output` as the draft body and `result.source`/`model`
  - Set `origin` to `ai` (or `co_authored` if applied over a manual draft)
  - Return `AUTHORING_AI_INCOMPLETE` (422 with unfilled fields) when the description is too
    vague to satisfy the schema
  - Add tests: structured output → body; vague → incomplete; source/model persisted
  - _Requirements: 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.5_

- [x] 12. Implement conversational refinement route
  - `app/api/thinkertools-missions-create/drafts/[draftId]/refine/route.ts`: accept one
    instruction, load the current draft body, call `runStructuredAi` with the refine prompts
    and the same schema (whole-object rewrite), persist the revised body and re-validate
  - Use `mockResponse: currentBody` so a missing API key degrades to "no change"
  - On inapplicable/ambiguous instruction or post-refine validation failure, return
    `AUTHORING_REFINE_INAPPLICABLE` (422) and leave the stored draft unchanged
  - Update `origin` to reflect AI involvement; optionally append to a `refinement_log`
  - Add tests: instruction applied + schema-valid + unaddressed fields preserved;
    inapplicable → unchanged; cumulative turns compose
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

### Phase 4 — Activity authoring end-to-end (Milestone 1)

- [x] 13. Build the authoring UI shell and draft list
  - `app/thinkertools-missions-create/page.tsx` (entry: list caller's drafts + "create")
  - `components/thinkertools-missions-create/draft-list.tsx`
  - `components/thinkertools-missions-create/draft-source-badge.tsx` (live-model vs fallback)
  - _Requirements: 1.1, 2.4_

- [x] 14. Build the activity editor with manual + AI + refine controls
  - `app/thinkertools-missions-create/drafts/[draftId]/page.tsx` and
    `components/thinkertools-missions-create/activity-editor.tsx`: editable fields, a
    "draft with AI" description box (calls generate), a refinement instruction box (calls
    refine), and inline validation-issue display
  - Show the source badge; keep manual edits and AI actions interchangeable
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 2.4, 3.1, 3.6, 8.1, 8.2_

- [x] 15. Implement the playable-by-URL preview for activities
  - `app/thinkertools-missions-create/drafts/[draftId]/play/page.tsx` renders the draft body
    through the existing learner contradiction-round component
  - Add a preview-scoped grading path (`preview: true`) that runs the same grading logic but
    writes no attempts/progress; gate access to the draft owner (403 otherwise)
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 16. Implement activity publish
  - `app/api/thinkertools-missions-create/drafts/[draftId]/publish/route.ts`: re-validate,
    require `status === 'valid'`, assign a unique slug, insert a `training_activities` row
    (`content_type='activity'`, `is_active=true`, `round_content = body`), record
    `published_ref_id`, set draft `status='published'`
  - On editing a published draft, return it to `draft` requiring re-validation
  - Return `AUTHORING_PUBLISH_NOT_VALID` / `AUTHORING_SLUG_CONFLICT` as specified
  - Add an integration test: create → validate → preview (no XP) → publish → appears in the
    learner contradiction list; edit published → back to draft
  - _Requirements: 6.3, 6.4, 6.5, 8.3, 8.4, 8.5_

### Phase 5 — Data-driven missions (migration + bounded refactor)

- [x] 17. Add the `mission_body` column and backfill wrong-recruit
  - Add `supabase/migrations/<ts>_missions_body_column.sql`: `alter table missions add
    column mission_body jsonb not null default '{}'::jsonb`, then backfill the `wrong-recruit`
    row with the `wrongRecruitMission` definition serialized as JSON
  - _Requirements: 6.4_

- [x] 18. Add a data-driven mission loader and refactor the complete route
  - Add `loadActiveMissionBySlug(slug)` to `lib/missions/server.ts` returning the row +
    `mission_body`
  - Refactor `app/api/thinkertools-missions/missions/[missionSlug]/complete/route.ts` to load
    the mission by slug, parse `mission_body` with `missionBodySchema`, and grade
    contradiction labels / resolution id against the stored body (reusing
    `isMatchingLabelPair` and all existing XP/replay/completion logic)
  - Add an integration test asserting the backfilled wrong-recruit grades, awards XP, and
    records completion identically to before (regression guard)
  - _Requirements: 4.2, 6.4_

- [x] 19. Make the mission render/play path data-driven
  - Refactor the mission render path to load `mission_body` by slug via the loader instead of
    importing `wrongRecruitMission`
  - Verify wrong-recruit still plays end to end through the data path
  - _Requirements: 6.4_

### Phase 6 — Mission authoring end-to-end (Milestone 2)

- [x] 20. Build the mission editor with manual + AI + refine controls
  - `components/thinkertools-missions-create/mission-editor.tsx`: edit stages, actions,
    claims, reviews, and debrief; "draft with AI" (generate) and refinement (refine) boxes;
    inline display of validation issues including graph-reachability failures
  - _Requirements: 1.1, 1.2, 1.4, 1.5, 3.1, 3.6, 8.1, 8.2_

- [x] 21. Extend preview and publish to missions
  - Make the preview play page render mission drafts through the data-driven mission render
    path (no XP/progress writes)
  - Extend the publish route to insert/upsert a `missions` row plus `mission_body`
    (`is_active=true`) and record `published_ref_id`
  - Add an integration test: author a mission draft → validate (incl. reachability) →
    preview → publish → appears as a playable mission
  - _Requirements: 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.4, 8.3, 8.4, 8.5_

## Notes

- **Milestone 1 (activities)** is fully shippable on its own: tasks 1–16 deliver manual,
  AI single-shot, and conversational authoring of contradiction activities with preview and
  publish. If hackathon time runs short, stop here — it is a complete, demoable story.
- **Milestone 2 (missions)** adds tasks 17–21. The risk concentrates in task 18 (the
  grade-route refactor); the wrong-recruit backfill (task 17) is the regression guard that
  proves the data-driven path against known-good content.
- **Authorization is hackathon-scoped**: "educator" = any authenticated actor, scoped to
  their own drafts. A privileged educator/admin role is deferred.
- **AI runs without an API key**: every AI task ships deterministic mocks (tasks 10–12), so
  generation and refinement are demoable offline and degrade gracefully.
- **Future Kane phase** attaches at the playable-by-URL preview (task 15 / 21) and the draft
  lifecycle; nothing here precludes it and no Kane work is in this plan.
