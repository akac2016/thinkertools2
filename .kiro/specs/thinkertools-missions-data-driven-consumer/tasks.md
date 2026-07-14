# Implementation Plan

## Overview

This plan makes the learner-facing ThinkerTools chat component read its content from the
database instead of hardcoded constants, delivered as a **three-phase staged cutover** so the
UI renders every published entity at every step:

- **Phase A — Parallel run.** Stand up the new nested REST read paths
  (`trainings`, `trainings/[trainingSlug]/groups`,
  `trainings/[trainingSlug]/groups/[groupSlug]/activities` + its `submit`) and flip the
  missions list route to a real query, while the legacy flat
  `training/contradiction-spotting` route and its `submit` stay **live and unchanged**. The
  component prefers DB data but keeps `skills` / `placeholderMissions` /
  `AVAILABLE_ACTIVITY_IDS` / slug constants as a **typed fallback**.
- **Phase B — Parity verification.** Prove the data-driven paths render the same published
  entity set and content as the constants (zero missing, zero extra) before removing anything.
- **Phase C — Cleanup (parity-gated).** ONLY after parity passes: remove the hardcoded
  constants AND retire the legacy flat `training/contradiction-spotting` route + its `submit`.

The XP normalization data migration is an **independent track** that can run in parallel with
the route work. Constant removal and legacy-route retirement are the **final,
dependency-gated** tasks — never early. Each task lists the requirements it implements; each is
incremental and ends in a wired, testable state. The 18 correctness properties from the design
are each implemented as a single property-based test (min 100 iterations) tagged
`Feature: thinkertools-missions-data-driven-consumer, Property {n}: {text}`; migration
properties (10, 12, 13) run against a transactional Postgres test instance, the rest via
`fast-check` on extracted pure logic plus integration tests against a seeded DB.

## Task Dependency Graph

Tasks grouped into execution waves; tasks within a wave are independent and can run in
parallel once their dependencies are met. The XP migration (task 11) is an independent track
runnable from wave 0. The parity gate (task 12) and the cleanup/retirement (task 13) are the
final dependency-gated waves — no constant is removed and no legacy route is retired until the
parity task passes.

```json
{
  "waves": [
    { "wave": 0, "tasks": ["1.1", "2.1", "3.1", "4.1", "5.1", "6.1", "11.1"], "dependsOn": [] },
    { "wave": 1, "tasks": ["1.2", "1.3", "1.4", "1.5", "2.2", "2.3", "3.2", "3.3", "4.2", "4.3", "5.2", "5.3", "5.4", "6.2", "6.3", "6.4", "6.5", "7.1", "11.2", "11.3", "11.4", "11.5"], "dependsOn": ["1.1", "2.1", "3.1", "4.1", "5.1", "6.1", "11.1"] },
    { "wave": 2, "tasks": ["7.2", "8.1"], "dependsOn": ["7.1"] },
    { "wave": 3, "tasks": ["8.2", "9.1"], "dependsOn": ["8.1"] },
    { "wave": 4, "tasks": ["9.2", "12.1"], "dependsOn": ["9.1", "11.1"] },
    { "wave": 5, "tasks": ["13.1", "13.2"], "dependsOn": ["12.1"] },
    { "wave": 6, "tasks": ["13.3"], "dependsOn": ["13.1", "13.2"] }
  ],
  "milestones": {
    "phase_a_parallel_run": ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
    "xp_migration_track": ["11"],
    "phase_b_parity": ["12"],
    "phase_c_cleanup": ["13"]
  }
}
```

Critical path: (6.1 → 7.1 → 8.1 → 9.1 → 12.1 → 13.1) gated by the parity task at 12.1. The XP
migration (11.x) and all Phase A server endpoints (1–5) run in parallel up front. Phase C
(13.x) is reachable only after 12.1 confirms parity.

## Tasks

### Phase A — Build data-driven read paths alongside constants (parallel run)

- [x] 1. Trainings enumeration endpoint
  - [x] 1.1 Implement `GET /api/thinkertools-missions/trainings`
    - Create `app/api/thinkertools-missions/trainings/route.ts`, gated by
      `requireActorIdFromRequest`; select `trainings` where `is_active = true`, cap at 200,
      order by `created_at` ascending; filter out rows missing a non-empty `id`/`slug`/`title`
      server-side; return `{ trainings: [{ id, slug, title, maxLevel }] }` via `jsonSuccess`
    - Extract the pure filter/cap/order logic into a small helper so it can be property-tested
      without a live DB
    - On query failure return `jsonError("Failed to load trainings", { status: 500, code: "MISSIONS_TRAININGS_LOAD_FAILED" })`
    - _Requirements: 1.1, 1.4, 1.8, 1.5_
  - [ ]* 1.2 Write property test for active-trainings filtering and cap
    - **Property 1: Active-trainings filtering and cap** — returns exactly `is_active = true`
      rows, no inactive rows, capped at 200
    - **Validates: Requirements 1.1**
  - [ ]* 1.3 Write property test for deterministic trainings ordering
    - **Property 3: Deterministic trainings ordering** — ordered by `created_at`; ordering the
      same unchanged data twice is identical
    - **Validates: Requirements 1.4**
  - [ ]* 1.4 Write property test for invalid-trainings omission
    - **Property 4: Invalid trainings are omitted, valid ones retained** — rows lacking a
      non-empty id/slug/title are excluded, all valid rows included
    - **Validates: Requirements 1.8**
  - [ ]* 1.5 Write unit test for the trainings load-failure envelope
    - On DB failure the endpoint returns the `MISSIONS_TRAININGS_LOAD_FAILED` error envelope
      with no partial list
    - _Requirements: 1.5_

- [x] 2. Activity-groups listing endpoint
  - [x] 2.1 Implement `GET /api/thinkertools-missions/trainings/[trainingSlug]/groups`
    - Create `app/api/thinkertools-missions/trainings/[trainingSlug]/groups/route.ts`, gated by
      `requireActorIdFromRequest`; resolve the active training by `[trainingSlug]` (reuse
      `getActiveTrainingBySlug`), returning `MISSIONS_TRAINING_NOT_FOUND` (404) on no match
    - Select `training_activity_groups` where `training_id` = resolved training and
      `is_active = true`; order by `display_order` ascending, tie-broken by `slug` ascending;
      return `{ groups: [{ id, slug, title, description, trainingId, displayOrder }] }`
    - Extract the pure filter/order logic for property testing; on query failure return
      `MISSIONS_ACTIVITY_GROUPS_LOAD_FAILED` (500)
    - _Requirements: 2.1, 2.2_
  - [ ]* 2.2 Write property test for activity-groups filtering
    - **Property 5: Activity-groups filtering by training and active state** — for groups
      spanning multiple trainings with mixed `is_active`, returns exactly the active groups for
      the given training and excludes all others
    - **Validates: Requirements 2.1**
  - [ ]* 2.3 Write property test for deterministic activity-groups ordering
    - **Property 6: Deterministic activity-groups ordering** — ordered by ascending
      `display_order`, ties broken by ascending `slug`
    - **Validates: Requirements 2.2**

- [x] 3. Group-scoped activities endpoint
  - [x] 3.1 Implement `GET /api/thinkertools-missions/trainings/[trainingSlug]/groups/[groupSlug]/activities`
    - Create the nested route; resolve the active training by `[trainingSlug]`
      (`MISSIONS_TRAINING_NOT_FOUND` on no match), then resolve the active group by `[groupSlug]`
      **within that training** (`MISSIONS_ACTIVITY_GROUP_NOT_FOUND` if absent/inactive/foreign →
      no activities)
    - Query `training_activities` filtered by `.eq("activity_group_id", <group id>)` and
      `is_active = true`; initialize/resolve progress and run the same round extraction the
      legacy route uses, returning the same `training`/`progress`/`rounds`/`completedRoundSlugs`
      shape **minus** the embedded `trainingCatalog`; an empty group returns `rounds: []`
    - Leave the legacy flat `training/contradiction-spotting/route.ts` live and unchanged
    - _Requirements: 2.4, 2.5, 2.6, 2.7_
  - [ ]* 3.2 Write property test for group-scoping isolation
    - **Property 8: Group-scoping isolation** — for activities spanning multiple groups with
      mixed `is_active`, returns only the resolved group's active activities and no activity
      from any other group and no inactive activity
    - **Validates: Requirements 2.4, 2.5**
  - [ ]* 3.3 Write property test for unknown/missing activity group
    - **Property 9: Unknown or missing activity group is an error with no activities** — an
      unmatched `[trainingSlug]`/`[groupSlug]` returns a not-found error and no activities
    - **Validates: Requirements 2.6**

- [x] 4. Moved grading/submit route (behavior unchanged)
  - [x] 4.1 Implement `POST /api/thinkertools-missions/trainings/[trainingSlug]/groups/[groupSlug]/activities/submit`
    - Create the nested submit route by moving the legacy grading logic; resolve the training
      from `[trainingSlug]` (NOT the hardcoded `ACTIVE_TRAINING_SLUG`) and scope to the group
      from `[groupSlug]`; the request body still carries `activitySlug`
    - Reuse all existing grading helpers unchanged (`isMatchingLabelPair`,
      `matchConstrainedTypedInput`, `normalizeLabelSelection`, `applyEarnedXp`,
      `computeCompletionRewardXp`, and the `extract*` round helpers); award
      `computeCompletionRewardXp({ baseXp: activityData.xp_reward, ... })` read at answer time;
      keep the legacy flat `submit` route live and unchanged
    - _Requirements: 3.4_
  - [ ]* 4.2 Write integration test for the nested submit/grading path (seeded DB)
    - Each of the five groups loads only its own 10 questions via the nested activities route; a
      correct submission to `.../activities/submit` awards XP and records a
      `training_activity_attempts` row identically to the legacy route
    - _Requirements: 2.4, 3.4_
  - [ ]* 4.3 Write property test for normalized-XP awards (seeded DB, after migration)
    - **Property 11: Correct answers award the normalized per-question XP** — after the XP
      migration, a correct submission at the recommended level awards exactly the activity's
      normalized `xp_reward` (group's mapped value); requires the migration (task 11.1) applied
    - **Validates: Requirements 3.4**

- [x] 5. Missions list endpoint — real query
  - [x] 5.1 Replace synthesize-one-mission with a real active-missions query
    - In `app/api/thinkertools-missions/missions/route.ts`, drop the
      `getActiveTrainingBySlug(wrongRecruit...)` lookup and the
      `upsertMissionCatalogEntry(wrongRecruitMission)` call; query `missions` where
      `is_active = true`, ordered by `slug` ascending
    - Load per-user completion in a single `in (mission_ids)` query against `mission_completions`
      and merge into each row; keep the existing `progress` payload; zero active missions →
      `missions: []`; on failure return `jsonError(..., { status: 500, code: "MISSIONS_LIST_LOAD_FAILED" })`
      with no partial list
    - Extract the pure active-filter/slug-order logic for property testing
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6, 4.7_
  - [ ]* 5.2 Write property test for active-missions filtering
    - **Property 14: Active-missions filtering** — returns exactly the active missions and
      excludes every inactive mission
    - **Validates: Requirements 4.1**
  - [ ]* 5.3 Write property test for deterministic missions ordering
    - **Property 16: Deterministic missions ordering** — ordered by ascending `slug`; ordering
      the same unchanged data twice is identical
    - **Validates: Requirements 4.5**
  - [ ]* 5.4 Write unit/integration tests for the missions list route (seeded DB)
    - Multiple active missions all returned (not just wrong-recruit) and the handler no longer
      calls `upsertMissionCatalogEntry`; zero missions → `missions: []`; failure → error
      envelope with no partial list; mission detail route still loads wrong-recruit via
      `mission_body` (regression guard)
    - _Requirements: 4.2, 4.3, 4.6, 4.7_

- [x] 6. Extract pure learner-view selection helpers
  - [x] 6.1 Implement the render-selection module the component will consume
    - Create a pure helper module (e.g. `lib/quests/learner-view.ts`) that maps endpoint
      payloads to render models: one entry per valid training (id/slug/title), skipping rows
      missing a non-empty id/slug/title; one entry per activity group in received order
      (slug/title/description); one entry per mission (slug/title/active state); resolve the
      `philosophical-reasoning` training by slug then key progress/level/XP by its **id**; and a
      fallback-merge helper for the typed constants
    - No live DB access — pure functions over endpoint shapes so they can be property-tested
    - _Requirements: 1.2, 1.3, 1.8, 2.3, 4.4, 5.2, 5.3, 5.4_
  - [ ]* 6.2 Write property test for trainings render mapping
    - **Property 2: Trainings render one entry each** — a list of two or more valid trainings
      yields a distinct entry per training (not one fixed entry), each showing id/slug/title
    - **Validates: Requirements 1.2, 1.3**
  - [ ]* 6.3 Write property test for activity-groups render mapping
    - **Property 7: Activity groups render in order with stored fields** — one entry per group
      in received order using each group's slug/title/description
    - **Validates: Requirements 2.3**
  - [ ]* 6.4 Write property test for missions render mapping
    - **Property 15: Missions render one entry each** — one entry per mission using its stored
      slug/title/active state
    - **Validates: Requirements 4.4**
  - [ ]* 6.5 Write property test for progress-by-id selection
    - **Property 17: Progress is keyed and displayed by training id** — the matched training and
      its displayed level/XP are keyed by the training's id (never its slug)
    - **Validates: Requirements 5.2, 5.3, 5.4**

- [x] 7. Component — trainings/groups enumeration, slug fix, progress by id
  - [x] 7.1 Wire the left rail and progress into `thinkertools-missions-chat.tsx`
    - On mount call `GET /trainings` and render one entry per returned training via the task-6
      helpers; for each training call `GET /trainings/[trainingSlug]/groups` and render its 5 DB
      groups in place of the 3 hardcoded `skills` entries; trainings load failure → error
      indication + retry control that re-requests trainings while keeping already-loaded content
      rendered; zero trainings → empty state
    - Replace `CONTRADICTION_SPOTTING_SKILL_ID = "philosophical-thinking"` matching with
      resolving `philosophical-reasoning` / "Philosophical Reasoning" and keying progress by the
      training **id**; missing `philosophical-reasoning` → "training could not be found" error
      and no level/XP; no progress record → default level-1 / 0-XP from
      `getOrCreateUserTrainingProgress`
    - Keep `skills` / `placeholderMissions` / `AVAILABLE_ACTIVITY_IDS` / slug constants as a
      **typed fallback** consulted only on endpoint failure/empty
    - _Requirements: 1.2, 1.3, 1.5, 1.6, 1.7, 1.8, 2.3, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.6_
  - [ ]* 7.2 Write unit tests for the left-rail and progress behavior
    - Trainings failure → error + retry and prior content preserved; zero trainings → empty
      state; slug resolves to `philosophical-reasoning` and never `philosophical-thinking`;
      missing training → error, no level/XP; no progress record → default level-1 / 0-XP;
      forced endpoint failure falls back to the typed constants (UI keeps rendering)
    - _Requirements: 1.5, 1.6, 1.7, 5.1, 5.5, 5.6, 6.1, 6.6_

- [x] 8. Component — group-scoped activity flow and submit wiring
  - [x] 8.1 Generalize `startActivity` and answer submission to the nested routes
    - In `thinkertools-missions-chat.tsx`, make `startActivity` take the selected **group** and
      call `GET /trainings/[trainingSlug]/groups/[groupSlug]/activities`; post answers to
      `POST /trainings/[trainingSlug]/groups/[groupSlug]/activities/submit` carrying the same
      `activitySlug` body; keep existing round rendering, `toggleClaimLabel`,
      `submitTrainingAnswer`, and `completedRoundSlugs` logic unchanged
    - A group returning `rounds: []` shows the existing empty-state for that group without
      breaking the rest of the training; constants remain the typed fallback on failure
    - _Requirements: 2.4, 2.7, 6.1_
  - [ ]* 8.2 Write unit test for the empty-group and activity-flow behavior
    - A zero-active-activity group renders the empty state while the rest of the training renders
      without error; endpoint failure falls back to the typed constants
    - _Requirements: 2.7, 6.1_

- [x] 9. Component — data-driven missions list
  - [x] 9.1 Render the missions list from `GET /missions`
    - In `thinkertools-missions-chat.tsx`, render one entry per returned mission
      (slug/title/active state) via the task-6 helpers; zero missions → empty state; load
      failure → error indication + retry control that re-requests missions; mission detail
      ("Start Mission") still uses the unchanged `GET /missions/[slug]` route; constants remain
      the typed fallback on failure
    - _Requirements: 4.4, 4.6, 4.7, 6.1_
  - [ ]* 9.2 Write unit test for the missions list behavior
    - Zero missions → empty state; load failure → error + retry; forced failure falls back to
      the typed constants
    - _Requirements: 4.6, 4.7, 6.1_

- [x] 10. Checkpoint — Phase A parallel run
  - Ensure all tests pass, ask the user if questions arise. The component must source content
    from the DB read paths while the legacy flat `training/contradiction-spotting` route + its
    `submit` remain live and the hardcoded constants remain as a typed fallback (nothing removed
    yet).

### Independent track — XP normalization data migration

- [x] 11. XP normalization data migration
  - [x] 11.1 Write `supabase/migrations/20260514050000_normalize_activity_xp_by_group.sql`
    - Data-only `UPDATE … FROM` joining `training_activities` → `training_activity_groups`, with
      a `CASE` over `display_order` (1→10, 2→25, 3→45, 4→75, 5→105; other groups unchanged),
      `display_order between 1 and 5`, an `is distinct from` idempotency guard, and
      `updated_at = now()`, wrapped in `begin; … commit;`
    - No DDL — no column added, altered, or dropped; touches `training_activities` rows only and
      does not modify `training_activity_attempts.awarded_xp`
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.7_
  - [ ]* 11.2 Write property test for XP uniformity and display-order mapping (transactional Postgres)
    - **Property 10: XP is uniform within group and matches the display-order mapping** — for
      any starting `xp_reward` values, after the migration every activity's `xp_reward` equals
      its group's mapped value, so all activities in a group share one identical value
    - **Validates: Requirements 3.1, 3.2**
  - [ ]* 11.3 Write property test for past XP untouched (transactional Postgres)
    - **Property 12: Previously earned XP is unchanged by the migration** — for any pre-existing
      `training_activity_attempts`, every `awarded_xp` value is identical pre/post migration
    - **Validates: Requirements 3.5**
  - [ ]* 11.4 Write property test for migration idempotence (transactional Postgres)
    - **Property 13: Migration idempotence** — applying the migration twice yields the same
      `xp_reward` values as one run, and the second run modifies zero already-normalized rows
    - **Validates: Requirements 3.7**
  - [ ]* 11.5 Write unit tests for schema invariance and transactional rollback (transactional Postgres)
    - No `ALTER TABLE ADD COLUMN` and the `training_activities` column set is identical pre/post;
      a forced mid-transaction failure rolls back all `xp_reward` changes and reports the failure
    - _Requirements: 3.3, 3.6_

### Phase B — Parity verification (gates Phase C)

- [x] 12. Parity verification gate
  - [x] 12.1 Implement the data-path parity verification
    - Build an automated parity check that enumerates the entities and rendered fields produced
      by the data-driven read paths against the published/known-good set and asserts **zero
      missing and zero extra** entities with matching displayed content; this check is the gate
      that must pass before any Phase C cleanup, and on failure the typed constants are retained
      so the UI keeps rendering
    - **Property 18: Data-path parity with the published content** — the entity set and
      displayed content from the data-driven read paths equals the expected published set (zero
      missing, zero extra)
    - **Validates: Requirements 6.2, 6.6**

### Phase C — Cleanup + legacy-route retirement (parity-gated; final)

- [x] 13. Constant removal and legacy-route retirement (only after task 12 passes)
  - [x] 13.1 Remove the hardcoded constants from the component
    - In `thinkertools-missions-chat.tsx`, delete `skills`, `placeholderMissions`,
      `AVAILABLE_ACTIVITY_IDS`, `CONTRADICTION_SPOTTING_SKILL_ID`, and
      `CONTRADICTION_SPOTTING_DISPLAY_TITLE`; source every training, group, activity, and mission
      solely from the DB read paths with no reference to a removed constant; the invented
      `explain-conflict` / `missing-context` "coming soon" activities and the fake
      `missing-premise` mission disappear because they have no DB backing
    - _Requirements: 6.3, 6.4, 6.5_
  - [x] 13.2 Retire the legacy flat contradiction-spotting routes
    - Delete `app/api/thinkertools-missions/training/contradiction-spotting/route.ts` and
      `app/api/thinkertools-missions/training/contradiction-spotting/submit/route.ts`, now fully
      superseded by the nested routes; confirm no remaining references to the flat paths
    - _Requirements: 6.4_
  - [ ]* 13.3 Write unit tests confirming the cleanup
    - The removed constants are absent and unreferenced; the two invented "coming soon"
      activities no longer render; the component reads exclusively from the DB read paths (no
      fallback path remains)
    - _Requirements: 6.3, 6.4, 6.5_

- [x] 14. Final checkpoint — post-cleanup
  - Ensure all tests pass, ask the user if questions arise. The component sources every entity
    from the database read paths, the legacy flat routes are gone, and no removed constant is
    referenced.

## Notes

- **Staged-cutover ordering is load-bearing.** Tasks 1–9 (Phase A) stand up the data paths
  while the legacy flat route + its `submit` stay live and the constants act as a typed
  fallback. Task 12 (Phase B) is the parity gate. Task 13 (Phase C) — constant removal AND
  legacy-route retirement — is the final dependency-gated step and must not start until task 12
  passes (Req 6.1, 6.6 → 6.3, 6.4, 6.5).
- **XP migration is an independent track.** Task 11 is data-only (no DDL) and runs in parallel
  from wave 0; it changes only future awards because the submit route reads `xp_reward` at
  answer time, so no submit-route change is needed for the award value.
- Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster path; core
  implementation tasks are never optional. The parity verification (12.1) is **not** optional —
  it is the gate for Phase C.
- Each correctness property is implemented by a single property-based test of at least 100
  iterations, tagged `Feature: thinkertools-missions-data-driven-consumer, Property {n}:
  {text}`. Properties 10, 12, 13 run against a transactional Postgres test instance; the rest
  via `fast-check` on extracted pure logic plus integration tests against a seeded DB.
- Reused infrastructure (no change): `jsonError`/`jsonSuccess`, `unexpectedError`/`parseBody`,
  `requireActorIdFromRequest`, `getActiveTrainingBySlug`, `getOrCreateUserTrainingProgress`,
  `loadActiveMissionBySlug`, all grading/round-extraction helpers, and the mission detail route
  (`missions/[missionSlug]/route.ts`) and `lib/quests/server-progress.ts`.
