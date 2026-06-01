# Design Document

## Overview

This design makes the learner-facing ThinkerTools chat component
(`components/thinkertools-missions/thinkertools-missions-chat.tsx`) read its content —
trainings, activity groups, activities, and missions — from the database instead of from
hardcoded constants, so that content published by the authoring feature
(`thinkertools-missions-create`) actually reaches learners. The authoring side already
writes approved rows into `trainings`, `training_activity_groups`, `training_activities`,
and `missions` with `is_active = true`; the gap this feature closes is purely on the
**consumer read paths**.

The work is delivered as a **staged cutover** rather than a flag-day rewrite: the
data-driven read paths are built and run *alongside* the existing hardcoded constants, parity
is verified against the published content, and only then — as the final cleanup step — are
the constants removed. The UI must render every published entity correctly at every
intermediate step.

### A defining constraint discovered in the codebase

The four entity types are at very different levels of "data-driven readiness," and the design
respects this asymmetry rather than treating them uniformly:

- **Activities are already loaded from the database**, but **not group-scoped, and served
  from a flat route named for one activity type.**
  `GET /api/thinkertools-missions/training/contradiction-spotting` reads `training_activities`
  rows for the active training and returns *all* of them (no `activity_group_id` filter), so
  the single "Contradiction Spotting" tab actually serves all 50 questions across all 5
  groups. The fix here is a **new nested route structure** that group-scopes —
  `trainings/[trainingSlug]/groups/[groupSlug]/activities` — replacing the flat
  contradiction-spotting path. This is the one place the feature adds a genuinely new data
  path rather than a surgical filter, chosen so the read surface can grow honestly to other
  trainings and activity types (see "Activity-loading approach" below). The legacy flat path
  is kept live during the cutover and retired at the final cleanup, not removed flag-day.
- **The trainings catalog is already returned but ignored.** The same training route already
  selects every `trainings` row and returns it as `trainingCatalog`; the component simply does
  not consume it. The fix is to consume existing data, with a small endpoint cleanup.
- **The mission detail route is already fully data-driven.**
  `GET /api/thinkertools-missions/missions/[missionSlug]` loads `mission_body` via
  `loadActiveMissionBySlug` and maps it through `missionBodySchema` +
  `missionBodyToDefinition`. This is the reference pattern; it needs **no change**.
- **The missions list route is the one that lies.**
  `GET /api/thinkertools-missions/missions` does **not** query the `missions` table — it calls
  `upsertMissionCatalogEntry(wrongRecruitMission)` and returns only that single seeded mission.
  This is the one route that must change from "synthesize one mission" to "query all active
  missions."

Consequence: **most of this feature is small, surgical changes to existing read paths plus a
component refactor.** The one piece of genuinely new HTTP surface is the nested activity
route structure (`trainings/[trainingSlug]/groups/[groupSlug]/activities` and its `submit`),
which replaces the flat contradiction-spotting path; everything else is consuming data that is
already returned or flipping a list route to a real query. The only schema-adjacent change is a
*data* migration (no DDL) that normalizes `training_activities.xp_reward` to be uniform within
each activity group. The implementation is sequenced so each step leaves a working UI, with the
hardcoded constants — and the legacy flat activity route — retained until the final
parity-verified cleanup.

### Requirements addressed

| Requirement | Addressed by |
|---|---|
| 1 — Data-driven trainings enumeration | Trainings enumeration (reuse `trainingCatalog`), left-rail refactor |
| 2 — Activity groups + group-scoped loading | Activity-groups listing (`trainings/[trainingSlug]/groups`), nested group-scoped activities endpoint (`trainings/[trainingSlug]/groups/[groupSlug]/activities`) |
| 3 — Per-question uniform-within-group XP | XP data migration (UPDATE…FROM, transactional, idempotent) |
| 4 — Data-driven missions listing | Missions list route real query; remove in-handler upsert |
| 5 — Slug correction + progress keyed by id | `philosophical-thinking` → `philosophical-reasoning`; match training by id |
| 6 — Staged cutover with parity verification | Parallel-run → parity check → constant removal sequencing |

## Architecture

### High-level read-path flow (after cutover)

```
                        ┌──────────────────────────────────────────────┐
                        │   Learner_UI (thinkertools-missions-chat.tsx)  │
                        │   left rail: trainings → activity groups       │
                        │   activity flow: selected group → questions    │
                        │   missions list                                │
                        └───────┬───────────┬───────────┬───────────┬────┘
                                │           │           │           │
   GET /trainings               │ GET .../  │ GET .../  │  GET      │
   (active, ordered)            │ [training │ [training │  missions │
                                │ Slug]/    │ Slug]/    │ (active,  │
                                │ groups    │ groups/   │ ordered)  │
                                │ (active,  │ [groupSlug│           │
                                ▼  ordered) ▼ ]/activities▼         ▼
        ┌───────────────┐ ┌──────────────────┐ ┌────────────────┐ ┌───────────────┐
        │ trainings      │ │ training_activity │ │ training_       │ │ missions       │
        │ where is_active│ │ _groups where     │ │ activities where│ │ where is_active│
        │ order created  │ │ training_id=? AND │ │ activity_group_ │ │ order slug     │
        └───────────────┘ │ is_active order   │ │ id=? AND active │ └───────────────┘
                          │ display_order,slug│ └────────────────┘
                          └──────────────────┘
              trainingSlug → trainings.id ─┘  groupSlug → group.id (within training)

        POST .../trainings/[trainingSlug]/groups/[groupSlug]/activities/submit
            grades by activitySlug + resolved training, awards xp_reward at answer time
        progress per training id ──► user_training_progress (user_id, training_id)
```

### Staged-cutover sequencing (Requirement 6)

The defining architectural property is that **no step removes a working path before its
replacement is proven**. Three phases:

**Phase A — Build data-driven read paths alongside constants (parallel run).**
- Stand up the nested activity routes (`trainings/[trainingSlug]/groups` listing and
  `trainings/[trainingSlug]/groups/[groupSlug]/activities` + its `submit`) that group-scope
  the questions, while leaving the legacy flat `training/contradiction-spotting` route and its
  `submit` live and unchanged so the un-refactored component keeps working.
- Switch the missions list route to a real query.
- Refactor the component to *prefer* data from the endpoints (calling the nested activity
  routes) while keeping the hardcoded `skills`, `placeholderMissions`, `AVAILABLE_ACTIVITY_IDS`,
  and slug constants in place as a **typed fallback** (used only if an endpoint fails or returns
  nothing). During this phase the UI is sourced primarily from the database but degrades to the
  constants on error, so Requirement 6.1 ("render every published entity without a flag-day
  removal") holds.

**Phase B — Parity verification.**
- Parity is defined (Requirement 6.2) as: for every published training, activity group,
  activity, and mission, the data-driven read paths render the **same set of entities and the
  same displayed content** as the constants would have — zero missing, zero extra. Because the
  constants only ever described one training, one real activity group (contradiction-spotting),
  and one real mission (wrong-recruit), parity is checked against the *published superset*: the
  data path must include those known-good entities and must additionally surface the other four
  groups and any other active missions.
- Verification is performed by a parity check (test + manual review) comparing the entity sets
  and rendered fields. If parity fails for any single entity, the constants are retained
  (Requirement 6.6) and cleanup does not proceed.

**Phase C — Constant removal + legacy-route retirement (final cleanup, only after parity confirmed).**
- Remove `skills`, `placeholderMissions`, `AVAILABLE_ACTIVITY_IDS`, and the slug constants
  (`CONTRADICTION_SPOTTING_SKILL_ID`, `CONTRADICTION_SPOTTING_DISPLAY_TITLE`).
- Retire the legacy flat activity routes
  (`training/contradiction-spotting/route.ts` and `training/contradiction-spotting/submit/route.ts`),
  now fully superseded by the nested routes. This retirement is part of the parity-gated
  cleanup, not a flag-day removal — the flat routes stay live through Phases A and B and are
  deleted only here, once the nested routes are proven at parity.
- The component then sources every entity from the database read paths and references no
  removed constant (Requirement 6.4). The two invented "coming soon" activities
  (`explain-conflict`, `missing-context`) and the fake `missing-premise` mission disappear
  because they have no database backing (Requirement 6.5).

### Activity-loading approach: decision and justification

The requirements need group scoping *and* multiple trainings, and the near-term roadmap adds
genuinely different activity types per training (economics, math, chemistry) with different
grading. Two options were considered:

- **Option A — Add an `activityGroupId` (and `trainingSlug`) query parameter to the existing
  `/training/contradiction-spotting` route** and add a sibling `/training/[trainingSlug]/groups`
  listing route. Minimal new surface; reuses the entire existing grading/round-extraction
  pipeline (`extractPromptClaims`, `extractQuestionText`, `extractExpectedAnswerCount`, the
  submit route) unchanged, but overloads a route literally named for one activity type.
- **Option B — Introduce a fully general nested REST shape**
  (`trainings/[trainingSlug]/groups` + `trainings/[trainingSlug]/groups/[groupSlug]/activities`
  + `.../activities/submit`), retiring the flat `contradiction-spotting` path at cleanup.

**Decision: Option B.** The user explicitly chose the general nested REST shape to support
adding genuinely different activity types per training in the near future (economics, math,
chemistry) with different grading, rather than continuing to overload a route literally named
"contradiction-spotting":

1. The nested `trainings/[trainingSlug]/groups/[groupSlug]/activities` structure makes URLs
   **honest and self-describing**: the path states which training and which group it serves, so
   group scoping is expressed in the route shape rather than smuggled in as a query parameter on
   a mis-named endpoint.
2. It **extends naturally to multiple trainings and diverse group/activity types.** When a
   future training needs a different activity runtime and grading, it slots into the same
   `[trainingSlug]/groups/[groupSlug]/activities` shape instead of requiring yet another
   top-level route named after a single skill.
3. The grading runtime that exists today (contradiction-spotting) is preserved intact — it
   simply moves under the nested `submit` path and resolves its training from the
   `[trainingSlug]` segment instead of a hardcoded constant. No grading logic changes.

**Tradeoff (recorded honestly):** Option B has more surface area than Option A — it introduces
new dynamic route segments (`[trainingSlug]`, `[groupSlug]`) and **re-points the submit/grading
path** from `training/contradiction-spotting/submit` to
`trainings/[trainingSlug]/groups/[groupSlug]/activities/submit`. Re-pointing the submit path is
the key cost of this option and carries more regression risk than Option A's one-line filter.
That risk is mitigated two ways: (a) the **staged cutover** keeps the legacy flat routes live
until the nested routes are verified at parity, so there is no flag-day switch; and (b) the
grading helpers are **reused unchanged** (`isMatchingLabelPair`, `matchConstrainedTypedInput`,
`normalizeLabelSelection`, `applyEarnedXp`, `computeCompletionRewardXp`, the round-extraction
helpers), so only the route's location and training-resolution change, not its behavior.

Concretely:

- **Activities endpoint (new, nested):**
  `GET /api/thinkertools-missions/trainings/[trainingSlug]/groups/[groupSlug]/activities`
  resolves the training by `[trainingSlug]`, resolves the group by `[groupSlug]` within that
  training (must be active and belong to that training), and returns only that group's active
  `training_activities` rows. It returns the same `rounds`/`progress`/`completedRoundSlugs`
  shape the component already consumes (minus the embedded `trainingCatalog`, which now lives
  on the dedicated `/trainings` route). An unknown/inactive `[trainingSlug]` or `[groupSlug]`
  returns an error (Requirement 2.6).
- **Activity-groups listing (new, nested):**
  `GET /api/thinkertools-missions/trainings/[trainingSlug]/groups` returns the active
  `training_activity_groups` for the training identified by the `[trainingSlug]` path segment,
  ordered by `display_order` then `slug`.
- **Submit endpoint (moved, no behavior change):**
  `POST /api/thinkertools-missions/trainings/[trainingSlug]/groups/[groupSlug]/activities/submit`
  grades by the `activitySlug` carried in the request body against the training resolved from
  `[trainingSlug]` (replacing the old hardcoded `ACTIVE_TRAINING_SLUG`), and awards
  `computeCompletionRewardXp` using `activityData.xp_reward`. The route now also scopes to the
  group. Because awards read the row's current `xp_reward` at answer time, the XP migration
  alone changes future awards; no grading change is needed for the award value (see XP migration).
- **Trainings enumeration (reuse + extract):** keep returning `trainingCatalog` from the legacy
  flat route during Phase A (so nothing breaks mid-cutover) and add a dedicated, cheap
  `GET /api/thinkertools-missions/trainings` so the component can enumerate trainings without
  also paying for round extraction. See "Trainings enumeration" below for why a dedicated
  route is preferred over only reusing the embedded catalog.
- **Legacy flat routes (retired at cleanup):** `training/contradiction-spotting/route.ts` and
  `training/contradiction-spotting/submit/route.ts` remain live and unchanged through Phases A
  and B, then are removed at Phase C alongside the hardcoded constants.

### Where code changes land

```
app/api/thinkertools-missions/
  trainings/route.ts                                         # NEW: GET active trainings (ordered)
  trainings/[trainingSlug]/groups/route.ts                   # NEW: GET active groups for a training (by slug)
  trainings/[trainingSlug]/groups/[groupSlug]/activities/route.ts        # NEW: group-scoped activities
  trainings/[trainingSlug]/groups/[groupSlug]/activities/submit/route.ts # NEW: grading/submit (moved here)
  training/contradiction-spotting/route.ts                   # RETIRED AT CLEANUP (kept live during Phase A/B)
  training/contradiction-spotting/submit/route.ts            # RETIRED AT CLEANUP (kept live during Phase A/B)
  missions/route.ts                          # CHANGE: real query; drop in-handler upsert
  missions/[missionSlug]/route.ts            # NO change (reference data-driven pattern)

components/thinkertools-missions/
  thinkertools-missions-chat.tsx             # CHANGE: enumerate trainings→groups from DB,
                                             #   nested group-scoped activity flow + submit,
                                             #   progress by id, constants kept as typed
                                             #   fallback then removed

lib/quests/
  server-progress.ts                         # NO change (already id-keyed); reuse helpers

supabase/migrations/
  20260514050000_normalize_activity_xp_by_group.sql   # NEW: data-only XP migration
```

### Reuse of existing infrastructure

- **HTTP**: `jsonError` / `jsonSuccess` from `lib/http.ts`, and `unexpectedError` /
  `parseBody` from `lib/api/route-utils.ts`, unchanged. New error codes follow the existing
  `MISSIONS_*` style.
- **Auth**: `requireActorIdFromRequest` from `lib/auth/actor.ts` on every route, unchanged.
- **Progress**: `getActiveTrainingBySlug` and `getOrCreateUserTrainingProgress` from
  `lib/quests/server-progress.ts` are already keyed by training **id** internally; they are
  reused as-is. The "key by id not slug" requirement (Req 5) is about the **frontend**
  matching trainings/progress by id, not these helpers.
- **Round extraction / grading**: `extractPromptClaims`, `extractQuestionText`,
  `extractExpectedAnswerCount`, `extractRoundTypeTag`, `extractCorrectAnswerLabels`,
  `getXpRequiredForNextLevel`, `computeCompletionRewardXp`, `applyEarnedXp`,
  `isMatchingLabelPair`, `matchConstrainedTypedInput`, `normalizeLabelSelection` — all reused
  unchanged.
- **Mission loading**: `loadActiveMissionBySlug` from `lib/missions/server.ts` (already used
  by the detail route) is reused for the missions list query pattern; the per-handler
  `upsertMissionCatalogEntry` call is removed from the list route.

## Components and Interfaces

All endpoints require an authenticated actor via `requireActorIdFromRequest` and respond with
the standard `jsonSuccess(data)` / `jsonError(message, { status, code, details })` envelope.

### Trainings enumeration — `GET /api/thinkertools-missions/trainings` (new)

Returns active trainings for the left rail (Requirement 1).

**Why a dedicated route rather than only reusing the embedded `trainingCatalog`:** the
legacy flat activity route returns `trainingCatalog` as a side payload, but it also runs
progress init and round extraction for the *active* training. The component's trainings
enumeration should not depend on a contradiction-spotting round load succeeding, and should not
pay for round extraction. A dedicated route keeps the enumeration concern isolated, lets the
component load trainings independently (so a training-load failure and an activity-load failure
are distinguishable per Req 1.5/1.6), and keeps a stable ordering contract. The embedded
`trainingCatalog` is retained on the legacy route during Phase A so nothing breaks mid-cutover,
and disappears when that route is retired at Phase C cleanup (the nested activities route does
not return a catalog).

Request: no parameters.

Response `200`:

```jsonc
{
  "ok": true,
  "data": {
    "trainings": [
      { "id": "uuid", "slug": "philosophical-reasoning", "title": "Philosophical Reasoning", "maxLevel": 20 }
    ]
  }
}
```

Behavior:
- Selects every `trainings` row with `is_active = true`, capped at 200 (Req 1.1).
- Orders by `created_at` ascending (a stored ordering field) so two consecutive requests over
  unchanged data return an identical order (Req 1.4).
- Rows missing a non-empty `id`, `slug`, or `title` are filtered out server-side so the
  component never has to render an invalid entry (supports Req 1.8; the component also guards).
- On DB failure: `jsonError("Failed to load trainings", { status: 500,
  code: "MISSIONS_TRAININGS_LOAD_FAILED" })` (Req 1.5).

### Activity-groups listing — `GET /api/thinkertools-missions/trainings/[trainingSlug]/groups` (new)

Returns the active activity groups for a training (Requirement 2.1–2.3). The training is
identified by the `[trainingSlug]` path segment rather than a query parameter.

Request: `[trainingSlug]` path segment (required by the route shape).

Response `200`:

```jsonc
{
  "ok": true,
  "data": {
    "groups": [
      {
        "id": "uuid",
        "slug": "philo-contradiction-spotting",
        "title": "Contradiction Spotting",
        "description": "Identify which two claims ...",
        "trainingId": "uuid",
        "displayOrder": 1
      }
    ]
  }
}
```

Behavior:
- Resolves the active training by `[trainingSlug]`. If no active training matches the slug →
  `jsonError("Training not found", { status: 404, code: "MISSIONS_TRAINING_NOT_FOUND" })`.
- Selects `training_activity_groups` where `training_id` matches the resolved training **and**
  `is_active = true`, excluding inactive rows (Req 2.1).
- Orders by `display_order` ascending, tie-broken by `slug` ascending (Req 2.2).
- On DB failure: `MISSIONS_ACTIVITY_GROUPS_LOAD_FAILED` (500).

This mirrors the group summary shape returned by the authoring route
`GET /api/thinkertools-missions-create/activity-groups?trainingId=`, but lives under the
learner namespace as a nested resource of the training and enforces the documented ordering
contract.

### Group-scoped activity loading — `GET /api/thinkertools-missions/trainings/[trainingSlug]/groups/[groupSlug]/activities` (new, replaces the flat contradiction-spotting route)

This nested route replaces `GET /training/contradiction-spotting`. It scopes the returned
questions to a single activity group identified by path segments rather than query parameters
(Requirement 2.4–2.6).

Request: `[trainingSlug]` and `[groupSlug]` path segments (required by the route shape).

Behavior:
1. Resolve the active training by `[trainingSlug]` (reusing `getActiveTrainingBySlug`). If no
   active training matches:
   ```ts
   return jsonError("Training not found", {
     status: 404, code: "MISSIONS_TRAINING_NOT_FOUND",
   });
   ```
2. Resolve the group by `[groupSlug]` **within that training**: it must be an active
   `training_activity_groups` row whose `training_id` equals the resolved training. If absent or
   unknown:
   ```ts
   return jsonError("Activity group not found", {
     status: 404, code: "MISSIONS_ACTIVITY_GROUP_NOT_FOUND",
   });
   ```
   This returns no activities (Req 2.6).
3. Query `training_activities` with `.eq("activity_group_id", <resolved group id>)` (and
   `is_active = true`) so only that group's active rows are returned; rows in other groups and
   inactive rows are excluded (Req 2.4, 2.5).
4. Initialize/resolve progress for the training (unchanged) and run the same round extraction
   the legacy route used, returning the same `training`, `progress`, `rounds`, and
   `completedRoundSlugs` shape — so the component's existing `LoadContradictionResponse`
   handling continues to work, `rounds` now group-scoped. The embedded `trainingCatalog` is
   **not** returned here; trainings enumeration now lives on the dedicated `/trainings` route.

A group with zero active activities returns `rounds: []`, which the component renders as an
empty-state group while still rendering the rest of the training (Req 2.7).

### Missions listing — `GET /api/thinkertools-missions/missions` (changed)

The route is changed from "synthesize one mission" to "query active missions" (Requirement 4).

Removed: the `getActiveTrainingBySlug(wrongRecruitMission.trainingSlug)` lookup and the
`upsertMissionCatalogEntry(wrongRecruitMission)` call (Req 4.2, 4.3). The wrong-recruit content
is already backfilled into `missions.mission_body` by migration `20260514020000`, so the
handler must not seed or upsert it.

New behavior:
- Query `missions` where `is_active = true`, excluding inactive rows (Req 4.1), ordered by
  `slug` ascending so consecutive requests over unchanged data return an identical order
  (Req 4.5).
- For each returned mission, load the caller's completion state from `mission_completions`
  (keyed by `user_id` + `mission_id`) — a single `in (mission_ids)` query rather than the
  current single-mission `maybeSingle`.
- `progress` is still returned for the active training (resolved via
  `getActiveTrainingBySlug(ACTIVE_TRAINING_SLUG)` and `getOrCreateUserTrainingProgress`), so
  the existing `LoadMissionsResponse.progress` contract is preserved.
- Zero active missions → `missions: []`, which the component renders as an empty state
  (Req 4.6).
- On DB failure: `jsonError(..., { status: 500, code: "MISSIONS_LIST_LOAD_FAILED" })` with
  **no** partial list (Req 4.7).

Response `200` (shape unchanged from today's per-mission entry):

```jsonc
{
  "ok": true,
  "data": {
    "progress": { "currentLevel": 1, "currentLevelXp": 0, "totalXp": 0,
                  "xpRequiredForNextLevel": 100, "xpRemainingForNextLevel": 100 },
    "missions": [
      { "id": "uuid", "slug": "wrong-recruit", "title": "The Wrong Recruit",
        "xpReward": 60, "isActive": true, "isCompleted": false, "completedAt": null,
        "awardedXp": 0, "replayCount": 0, "canReplay": true }
    ]
  }
}
```

### Mission detail — `GET /api/thinkertools-missions/missions/[missionSlug]` (no change)

Already data-driven via `loadActiveMissionBySlug` + `missionBodySchema` +
`missionBodyToDefinition`. Retained as the reference pattern and as the loader the missions
list route's row shape is consistent with.

### Submit — `POST /api/thinkertools-missions/trainings/[trainingSlug]/groups/[groupSlug]/activities/submit` (moved, no behavior change)

The grading/submit endpoint **moves** under the nested structure (it was
`POST /training/contradiction-spotting/submit`). This re-pointing is the key cost of Option B;
the grading **logic is unchanged**. The route grades by the `activitySlug` carried in the
request body against the training resolved from the `[trainingSlug]` path segment (replacing the
old hardcoded `ACTIVE_TRAINING_SLUG`), now also scoped to the group from `[groupSlug]`, then
awards `computeCompletionRewardXp({ baseXp: activityData.xp_reward, ... })` using the same helpers
as before (`isMatchingLabelPair`, `matchConstrainedTypedInput`, `normalizeLabelSelection`,
`applyEarnedXp`). The award is computed from the row's **current** `xp_reward` read at answer
time. Therefore:

- What changes: the URL/location and how the route resolves the training (from `[trainingSlug]`
  instead of a hardcoded constant). The submit body still carries the `activitySlug`.
- What does not change: the grading logic and XP award computation.
- After the XP migration normalizes `xp_reward`, a correct answer awards exactly the group's
  normalized per-question value (Req 3.4) **with no grading change** — only the route location
  moved.
- Previously recorded `training_activity_attempts.awarded_xp` rows are not touched by the
  migration, so XP already earned before the migration is unchanged (Req 3.5).

The "future awards only" reasoning still holds: awards read `xp_reward` from the row at answer
time, so the migration alone governs future award values regardless of where the submit route
lives.

### Component refactor — `components/thinkertools-missions/thinkertools-missions-chat.tsx`

The component is refactored in place, preserving the existing chat/quest/activity machinery
and only changing how content is sourced.

**Left rail: trainings → activity groups.**
- On mount, call `GET /trainings` to enumerate active trainings (Req 1.2, 1.3). Render one
  entry per returned training using its stored `id`, `slug`, `title`. Skip any training
  missing a non-empty `id`/`slug`/`title` and continue rendering the rest (Req 1.8). Zero
  trainings → empty state (Req 1.7). Load failure → error indication + retry control that
  re-requests trainings, while still rendering anything already loaded (Req 1.5, 1.6).
- For each training, call `GET /trainings/<trainingSlug>/groups` to enumerate its activity
  groups, rendering one entry per group in the received order using the group's `slug`,
  `title`, `description` (Req 2.3). This replaces the hardcoded `skills[].activities`
  structure: the five DB groups become the activity entries under the training (decision
  locked: replace the 3 hardcoded entries with the 5 DB groups).

**Activity flow: selected group → questions.**
- `startActivity` is generalized to take the selected **group** and call
  `GET /trainings/<trainingSlug>/groups/<group.slug>/activities`, so only that group's
  questions load (Req 2.4). The existing round rendering, `toggleClaimLabel`,
  `submitTrainingAnswer`, and `completedRoundSlugs` logic are unchanged — they already operate
  on whatever `rounds` the endpoint returns.
- Answer submission posts to the nested
  `POST /trainings/<trainingSlug>/groups/<group.slug>/activities/submit` endpoint (the moved
  grading route), carrying the same `activitySlug` body it sends today; the response handling
  is unchanged.
- A group that returns `rounds: []` shows the existing "no content available yet" empty state
  for that group without breaking the rest of the training (Req 2.7).

**Progress keyed by training id (Req 5).**
- Replace `CONTRADICTION_SPOTTING_SKILL_ID = "philosophical-thinking"` matching with matching
  by the training **id** returned from `/trainings` (Req 5.2, 5.4). The display resolves the
  `philosophical-reasoning` training by slug from the endpoint result, then keys progress and
  level/XP display by that training's id (Req 5.1, 5.3).
- If `/trainings` returns no training whose slug is `philosophical-reasoning`, show a
  "training could not be found" error and display no level/XP (Req 5.5).
- If no progress record exists for the matched training id, the server's
  `getOrCreateUserTrainingProgress` returns a fresh level-1 / 0-XP record, which the component
  displays as the default starting state (Req 5.6).

**Missions list.**
- Render one entry per mission returned by `GET /missions` using `slug`, `title`, and active
  state (Req 4.4). Zero missions → empty state (Req 4.6). Load failure → error + retry control
  (Req 4.7). The mission detail load (on "Start Mission") continues to use the unchanged
  `GET /missions/[slug]` route.

**Hardcoded constants as typed fallback, then removed.**
- During Phase A/B the constants `skills`, `placeholderMissions`, `AVAILABLE_ACTIVITY_IDS`,
  `CONTRADICTION_SPOTTING_SKILL_ID`, `CONTRADICTION_SPOTTING_DISPLAY_TITLE` remain in the file
  as typed values, consulted only when an endpoint fails or returns empty, so the UI never
  regresses mid-cutover (Req 6.1, 6.6).
- At Phase C cleanup (after parity confirmed) they are deleted, and the component sources
  every entity from the endpoints with no reference to a removed constant (Req 6.3, 6.4). The
  invented `explain-conflict` / `missing-context` activities and the fake `missing-premise`
  mission are gone (Req 6.5).

## Data Models

No schema changes. The feature reads existing tables and runs one **data-only** migration.
Frontend-facing view models below describe the shapes the component consumes.

### Tables read (existing)

- `trainings(id, slug, title, description, max_level, is_active, created_at, updated_at)` —
  one active row seeded: `philosophical-reasoning` / "Philosophical Reasoning".
- `training_activity_groups(id, slug, title, description, training_id, template_family,
  display_order, is_active, created_at, updated_at)` — 5 active groups under
  philosophical-reasoning, `display_order` 1–5.
- `training_activities(id, slug, title, primary_training_id, activity_group_id, content_type,
  is_active, xp_reward, recommended_level_min, recommended_level_max, round_content, ...)` —
  50 active rows, 10 per group.
- `missions(id, slug, title, primary_training_id, content_type, narrative_hook,
  short_description, difficulty_label, required_training_level, xp_reward, rewards_metadata,
  mission_body, is_active, ...)` — wrong-recruit backfilled into `mission_body`.
- `user_training_progress(id, user_id, training_id, current_level, current_level_xp,
  total_xp, ...)` — keyed by `(user_id, training_id)`.
- `training_activity_attempts`, `mission_completions` — per-user completion records;
  `awarded_xp` recorded at answer time and never rewritten by this feature.

### Frontend view models (TypeScript)

```ts
// Trainings enumeration (GET /trainings)
type TrainingSummary = {
  id: string;
  slug: string;
  title: string;
  maxLevel: number;
};

// Activity group (GET /trainings/[trainingSlug]/groups)
type ActivityGroupSummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  trainingId: string;
  displayOrder: number;
};

// Group-scoped rounds (GET /trainings/[trainingSlug]/groups/[groupSlug]/activities) reuse the
// existing ContradictionRound + LoadContradictionResponse types, minus the embedded
// trainingCatalog (which now comes from GET /trainings).
// Mission list entries reuse the existing LoadMissionsResponse["missions"][number] shape.
```

The component's existing `ProgressState`, `ContradictionRound`, `LoadContradictionResponse`,
and `LoadMissionsResponse` types are kept; the new view models are added for the trainings and
groups enumerations. The hardcoded `Skill` / `SkillActivity` / `Mission` placeholder types
remain only as the typed-fallback shapes until Phase C.

### XP normalization data migration — `supabase/migrations/20260514050000_normalize_activity_xp_by_group.sql`

A **data-only** migration (no DDL, no new column) that normalizes
`training_activities.xp_reward` so every activity within a group shares one value, mapping by
the group's `display_order` (Requirement 3):

| `display_order` | Group | XP per question |
|---|---|---|
| 1 | Contradiction Spotting | 10 |
| 2 | Rule vs. Exception | 25 |
| 3 | Principle vs. Action | 45 |
| 4 | Universal vs. Edge Case | 75 |
| 5 | Incompatible Belief Set | 105 |

Approach: a single `UPDATE … FROM` join from `training_activities` to
`training_activity_groups`, deriving the target XP from `display_order` via a `CASE`
expression, wrapped in an explicit transaction:

```sql
-- Migration: normalize training_activities.xp_reward to be uniform within each
-- activity group. Data-only: no columns added, altered, or dropped.
set search_path = public;

begin;

update public.training_activities ta
set
  xp_reward = case g.display_order
    when 1 then 10
    when 2 then 25
    when 3 then 45
    when 4 then 75
    when 5 then 105
    else ta.xp_reward          -- groups outside 1..5 are left unchanged
  end,
  updated_at = now()
from public.training_activity_groups g
where ta.activity_group_id = g.id
  and g.display_order between 1 and 5
  and ta.xp_reward is distinct from (case g.display_order
    when 1 then 10
    when 2 then 25
    when 3 then 45
    when 4 then 75
    when 5 then 105
  end);                        -- idempotency guard: only touch rows not already normalized

commit;
```

Key properties:
- **Idempotent.** The `is distinct from` guard means a re-run updates only rows whose
  `xp_reward` is not already the normalized value; once every row holds its target, a re-run
  matches zero rows and produces an identical end state (Req 3.7).
- **Transactional / all-or-nothing.** The `begin; … commit;` block means a failure mid-update
  rolls back every change in the statement, restoring the pre-migration `xp_reward` values
  (Req 3.6). A single `UPDATE` statement is itself atomic; the explicit transaction documents
  intent and groups it with any future guard statements.
- **Existing rows only, no schema change.** Only `training_activities` rows are updated; no
  group-level XP column, leveling column, or any other column is added (Req 3.3).
- **Future awards only.** The migration does not touch `training_activity_attempts.awarded_xp`;
  because the submit route awards `xp_reward` read at answer time, normalized values apply only
  to awards granted after the migration (Req 3.5), satisfied without retroactive edits.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions
of a system — essentially, a formal statement about what the system should do. Properties
serve as the bridge between human-readable specifications and machine-verifiable correctness
guarantees.*

The properties below were derived from the acceptance criteria via prework analysis and
reflection (redundant criteria were consolidated — e.g. the inclusion/exclusion halves of
group scoping became one isolation property, and the XP uniformity + display_order mapping
criteria became one property). Each is universally quantified and implementable as a single
property-based test running a minimum of 100 iterations.

### Property 1: Active-trainings filtering and cap

*For any* set of `trainings` rows, the Trainings_Endpoint returns exactly the rows whose
`is_active` is true, with no inactive rows present, capped at 200 entries.

**Validates: Requirements 1.1**

### Property 2: Trainings render one entry each

*For any* list of valid trainings returned by the Trainings_Endpoint, the Learner_UI renders
exactly one entry per training (so a list of two or more trainings yields a distinct entry per
training rather than a single fixed entry), each displaying that training's id, slug, and
title.

**Validates: Requirements 1.2, 1.3**

### Property 3: Deterministic trainings ordering

*For any* set of trainings, the Trainings_Endpoint returns them ordered by the stored
`created_at` field, and ordering the same unchanged data twice produces an identical sequence.

**Validates: Requirements 1.4**

### Property 4: Invalid trainings are omitted, valid ones retained

*For any* list of trainings in which some rows lack a non-empty id, slug, or title, the
rendered/returned set excludes every invalid row and includes every valid row.

**Validates: Requirements 1.8**

### Property 5: Activity-groups filtering by training and active state

*For any* set of `training_activity_groups` rows spanning multiple trainings with mixed
`is_active` values, the Activity_Groups_Endpoint for a given training returns exactly the
active groups whose `training_id` matches that training and excludes all others.

**Validates: Requirements 2.1**

### Property 6: Deterministic activity-groups ordering

*For any* set of activity groups, the Activity_Groups_Endpoint orders them by ascending
`display_order`, breaking ties by ascending `slug`.

**Validates: Requirements 2.2**

### Property 7: Activity groups render in order with stored fields

*For any* ordered list of activity groups returned by the endpoint, the Learner_UI renders one
entry per group in the received order, using each group's stored slug, title, and description.

**Validates: Requirements 2.3**

### Property 8: Group-scoping isolation

*For any* set of `training_activities` spanning multiple groups with mixed `is_active` values,
a request to the nested activities endpoint
(`trainings/[trainingSlug]/groups/[groupSlug]/activities`) for a given training/group returns
only activities whose `activity_group_id` equals the resolved group's id and whose `is_active`
is true, and returns no activity from any other group and no inactive activity.

**Validates: Requirements 2.4, 2.5**

### Property 9: Unknown or missing activity group is an error with no activities

*For any* `[groupSlug]` (or `[trainingSlug]`) that does not match an active activity group
within the resolved training, the nested activities endpoint returns a not-found error response
and returns no activities.

**Validates: Requirements 2.6**

### Property 10: XP is uniform within group and matches the display-order mapping

*For any* starting `training_activities.xp_reward` values, after the XP_Migration completes,
every activity's `xp_reward` equals the value mapped from its group's `display_order`
(1→10, 2→25, 3→45, 4→75, 5→105); consequently all activities within the same group hold one
identical value.

**Validates: Requirements 3.1, 3.2**

### Property 11: Correct answers award the normalized per-question XP

*For any* activity after the XP_Migration, a correct submission at the recommended level awards
exactly that activity's normalized `xp_reward` (the group's mapped value), because the submit
path computes the award from the row's current `xp_reward`.

**Validates: Requirements 3.4**

### Property 12: Previously earned XP is unchanged by the migration

*For any* set of pre-existing `training_activity_attempts` rows, running the XP_Migration leaves
every `awarded_xp` value identical to its pre-migration value.

**Validates: Requirements 3.5**

### Property 13: Migration idempotence

*For any* starting state, applying the XP_Migration twice produces the same `xp_reward` values
as applying it once, and the second run modifies zero rows that already hold their normalized
value.

**Validates: Requirements 3.7**

### Property 14: Active-missions filtering

*For any* set of `missions` rows with mixed `is_active` values, the Missions_Endpoint returns
exactly the active missions and excludes every inactive mission.

**Validates: Requirements 4.1**

### Property 15: Missions render one entry each

*For any* list of missions returned by the Missions_Endpoint, the Learner_UI renders exactly
one entry per mission using that mission's stored slug, title, and active state.

**Validates: Requirements 4.4**

### Property 16: Deterministic missions ordering

*For any* set of missions, the Missions_Endpoint orders them by ascending `slug`, and ordering
the same unchanged data twice produces an identical sequence.

**Validates: Requirements 4.5**

### Property 17: Progress is keyed and displayed by training id

*For any* training resolved from the Trainings_Endpoint, the Learner_UI matches the training and
requests/displays its Progress by the training's id (never by its slug), so the displayed level
and XP equal the progress record keyed by that id.

**Validates: Requirements 5.2, 5.3, 5.4**

### Property 18: Data-path parity with the published content

*For any* set of published trainings, activity groups, activities, and missions, the set of
entities and the displayed content produced by the data-driven read paths equals the expected
published set — zero missing entities and zero extra entities.

**Validates: Requirements 6.2**

## Error Handling

All routes follow the established `jsonError(message, { status, code, details })` convention
and reuse `unexpectedError` for the catch-all 500. New codes extend the existing `MISSIONS_*`
family:

| Code | Status | When |
|---|---|---|
| `MISSIONS_TRAININGS_LOAD_FAILED` | 500 | trainings enumeration query fails (Req 1.5) |
| `MISSIONS_TRAINING_NOT_FOUND` | 404 | `[trainingSlug]` matches no active training (groups + activities routes) |
| `MISSIONS_ACTIVITY_GROUPS_LOAD_FAILED` | 500 | activity-groups query fails |
| `MISSIONS_ACTIVITY_GROUP_NOT_FOUND` | 404 | `[groupSlug]` unknown/inactive for the resolved training (Req 2.6) |
| `MISSIONS_LIST_LOAD_FAILED` | 500 | missions list query fails; no partial list returned (Req 4.7) |

The `MISSIONS_TRAINING_ID_REQUIRED` code from the prior (query-param) design is no longer
needed: under the nested REST shape the training is a required `[trainingSlug]` path segment, so
"missing training identifier" is structurally impossible. Its intent is replaced by
`MISSIONS_TRAINING_NOT_FOUND` when the slug matches no active training.

Existing reused codes: `MISSIONS_TRAINING_LOAD_FAILED`,
`MISSIONS_ACTIVITY_LOAD_FAILED`, `MISSIONS_COMPLETED_ROUNDS_LOAD_FAILED`,
`MISSIONS_PROGRESS_*`, `MISSIONS_ROUNDS_UNEXPECTED`, `MISSIONS_LOAD_UNEXPECTED`.

Client-side error handling (Learner_UI):
- Trainings load failure → error indication + retry control that re-requests trainings, while
  any already-loaded content remains rendered (Req 1.5, 1.6).
- Missions load failure → error indication + retry control that re-requests missions; no
  partial list is shown because the endpoint returns an error envelope rather than partial data
  (Req 4.7).
- Missing `philosophical-reasoning` training → "training could not be found" indication and no
  level/XP rendered (Req 5.5).
- A group with zero active activities and zero missions are *not* errors — they render
  documented empty states (Req 2.7, 4.6).

The error path does not require new envelope machinery; it reuses the `ApiError` shape from
`lib/http.ts` and the `apiFetch` / `isApiRequestError` handling the component already uses.

## Testing Strategy

### Dual approach

- **Property-based tests** verify the universal properties above across generated inputs.
- **Unit / example tests** cover specific scenarios, edge cases, and error conditions.
- **Integration tests** cover end-to-end read paths against a test database where input
  variation does not add value.

### Property-based testing

PBT **is** appropriate for this feature: the read-path filtering, ordering, group-scoping
isolation, XP normalization, and parity behaviors are deterministic functions of their inputs
with large input spaces (arbitrary row sets, mixed active flags, arbitrary starting XP). These
are exactly the cases where 100+ generated iterations find edge cases that 2–3 examples miss.

- Library: use the project's JavaScript/TypeScript property testing library
  (`fast-check`) for the endpoint/UI logic properties, and a SQL-level harness (run the
  migration against a seeded Postgres/Supabase test instance with generated starting states)
  for the migration properties (10, 12, 13). Do not implement PBT from scratch.
- Minimum 100 iterations per property test.
- Each property test is tagged with a comment referencing its design property, in the format:
  **Feature: thinkertools-missions-data-driven-consumer, Property {number}: {property_text}**
- Each correctness property is implemented by a **single** property-based test.
- Generators: training/group/activity/mission row factories with controllable `is_active`,
  `display_order`, `activity_group_id`, `training_id`, `xp_reward`, and field-presence (to
  drive Property 4's invalid-row omission). Pure filtering/ordering/render logic is extracted
  so it can be exercised without a live database; the migration properties run against a real
  transactional Postgres test instance.

### Unit / example and edge-case tests

- Trainings: failure → error + retry (Req 1.5); failure preserves prior content (Req 1.6);
  zero trainings → empty state (Req 1.7).
- Activity groups: zero-active-activity group → empty-state group, rest of training renders
  (Req 2.7).
- XP migration: schema unchanged — no `ALTER TABLE ADD COLUMN` and the column set is identical
  pre/post (Req 3.3); forced mid-transaction failure → all `xp_reward` restored + failure
  reported (Req 3.6).
- Missions: reads from the table (multiple active missions all returned, not just wrong-recruit)
  and the handler no longer calls `upsertMissionCatalogEntry` (Req 4.2, 4.3); zero missions →
  empty state (Req 4.6); failure → error + retry, no partial list (Req 4.7).
- Slug correction: component resolves `philosophical-reasoning` / "Philosophical Reasoning" and
  never references `philosophical-thinking` (Req 5.1); missing training → error, no level/XP
  (Req 5.5); no progress record → default level-1 / 0-XP (Req 5.6).
- Staged cutover: with endpoints live, content sourced from data paths and constants act as
  fallback on failure (Req 6.1); after cleanup the constants are absent and unreferenced and the
  invented "coming soon" activities no longer render (Req 6.3, 6.4, 6.5); a forced parity
  mismatch retains the constants/fallback so the UI keeps rendering (Req 6.6).

### Integration tests

- Group-scoped activity load against a seeded DB via the nested route
  (`trainings/[trainingSlug]/groups/[groupSlug]/activities`): each of the five groups returns
  only its own 10 questions; submitting a correct answer to the nested
  `.../activities/submit` route awards the group's normalized XP and records an attempt.
- Missions list against a seeded DB returns all active missions ordered by slug, with per-user
  completion state merged in.
- Mission detail (unchanged) continues to load wrong-recruit via `mission_body` — regression
  guard that the list-route change did not disturb the detail path.

### Parity verification (Requirement 6.2)

A dedicated parity check (Property 18 plus a manual review) compares the data-path entity set
and rendered fields against the published content before constant removal. Cleanup proceeds only
when parity holds for every entity; otherwise the constants are retained (Req 6.6).

## Design Decisions and Rationale

1. **Adopt a general nested REST shape (`trainings/[trainingSlug]/groups/[groupSlug]/activities`
   + `.../submit`), retiring the flat `contradiction-spotting` path at cleanup** rather than
   bolting an `activityGroupId` query parameter onto the existing route (Option A). The user
   chose this to support adding genuinely different activity types per training in the near
   future (economics, math, chemistry) with different grading: the nested structure makes URLs
   honest and self-describing and extends naturally to multiple trainings and diverse
   group/activity types, instead of overloading a route literally named for one skill.
   **Tradeoff:** Option B has more surface area — new dynamic route segments plus re-pointing
   the submit/grading path — and therefore more regression risk than Option A's one-line filter.
   This is mitigated by the staged cutover (the legacy flat routes stay live until the nested
   routes are verified at parity) and by reusing the grading helpers (`isMatchingLabelPair`,
   `matchConstrainedTypedInput`, `normalizeLabelSelection`, `applyEarnedXp`,
   `computeCompletionRewardXp`) unchanged, so only the route's location and training-resolution
   change, not its behavior.
2. **Dedicated `/trainings` route despite the existing embedded `trainingCatalog`** — isolates
   enumeration from round-extraction and progress init so a training-load failure and an
   activity-load failure are distinguishable, and the catalog is retained during cutover so
   nothing breaks mid-migration.
3. **Data-only XP migration via `UPDATE … FROM` with a `CASE` over `display_order`** — keeps XP
   per question (no schema column), is idempotent via the `is distinct from` guard, and is
   transactional so a partial failure rolls back. No submit-route change is needed because
   awards read the row's `xp_reward` at answer time, which naturally satisfies "future awards
   only."
4. **Staged cutover with constants as a typed fallback** — guarantees a working UI at every
   step and a parity gate before any constant is removed, per Requirement 6.
5. **No change to the already-data-driven mission detail route** — it is the reference pattern;
   only the list route, which synthesizes a single mission, is corrected.
