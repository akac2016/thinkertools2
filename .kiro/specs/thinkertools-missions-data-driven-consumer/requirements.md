# Requirements Document

## Introduction

ThinkerTools Missions — Learner-Facing (Consumer) Experience makes the learner-facing
ThinkerTools UI read its content from the database instead of from hardcoded constants. A
prior authoring feature (`thinkertools-missions-create`) already built the publish pipeline
that writes approved content into the `trainings`, `training_activity_groups`,
`training_activities`, and `missions` tables with `is_active = true`. The gap this feature
closes is that the learner-facing chat component
(`components/thinkertools-missions/thinkertools-missions-chat.tsx`) still reads from
hardcoded constants, so published content never reaches learners. This feature makes the
consumer read paths data-driven so the publish → play loop actually closes.

The current state has several concrete problems this feature resolves:

- The chat component hardcodes a `skills` array containing three activity entries, two of
  which correspond to **no** database content (they are invented placeholders), plus a
  `placeholderMissions` constant and an `AVAILABLE_ACTIVITY_IDS` "coming soon" gate.
- The database actually contains **five** activity groups (rows in
  `training_activity_groups`), each with ten seeded questions (fifty total), all under the
  `philosophical-reasoning` training.
- The training-load endpoint returns **all** active activities for the training (no
  `activity_group_id` filter), so the single "Contradiction Spotting" tab serves all fifty
  questions across all five groups.
- The missions-list endpoint does not query the `missions` table; it upserts and returns
  only the imported `wrongRecruitMission` constant, so published missions never appear.
- A latent defect: the component uses the skill id `philosophical-thinking` / title
  "Philosophical Thinking" while the real database training slug is `philosophical-reasoning`
  / "Philosophical Reasoning"; it works today only because two constants happen to match
  each other. Learner progress is keyed off the training slug rather than the training id.

This release is delivered through a **staged cutover**: the data-driven read paths are built
and run alongside the existing hardcoded data, parity is verified, and only then are the
constants removed. There is no flag-day rewrite; the UI must work at every step.

### Scope (this release)

- In scope: enumerating active trainings from the database; expanding each training into its
  activity groups from `training_activity_groups`; group-scoped question loading via an
  `activity_group_id`-filtered endpoint; a data migration that normalizes per-question
  `xp_reward` to be uniform within each group; a real missions-list query over active
  mission rows; fixing the `philosophical-thinking` → `philosophical-reasoning` slug mismatch;
  keying learner progress off training id; and the staged-cutover parity verification and
  removal of hardcoded constants.
- Out of scope: the authoring/create/publish flow (covered by
  `thinkertools-missions-create`); adding a group-level XP or leveling schema column;
  automated Kane CLI verification; and creating new training content beyond what already
  exists or what the authoring flow publishes.

## Glossary

- **Learner_UI**: The learner-facing chat component
  (`components/thinkertools-missions/thinkertools-missions-chat.tsx`) that renders trainings,
  activity groups, activities, and missions to a learner.
- **Training**: A learning track stored as a `trainings` row (e.g. "Philosophical
  Reasoning"). An active training has `is_active = true`.
- **Activity_Group**: A named exercise type within a training, stored as a
  `training_activity_groups` row (e.g. "Contradiction Spotting"). Activity groups sit between
  a training and its individual activities, and carry a `display_order` and `is_active` flag.
- **Activity**: A single graded question stored as a `training_activities` row, linked to its
  group via `activity_group_id` and carrying a per-question `xp_reward`.
- **Mission**: A multi-stage, story-driven flow stored as a `missions` row. An active mission
  has `is_active = true`.
- **Trainings_Endpoint**: The server endpoint that returns the list of active trainings to
  the Learner_UI.
- **Activity_Groups_Endpoint**: The server endpoint that returns the activity groups for a
  training to the Learner_UI.
- **Activity_Endpoint**: The per-activity-type endpoint
  (`GET /api/thinkertools-missions/training/contradiction-spotting`) that returns the
  questions for one activity group, scoped by `activity_group_id`.
- **Missions_Endpoint**: The missions-list endpoint
  (`GET /api/thinkertools-missions/missions`) that returns the list of missions to the
  Learner_UI.
- **XP_Migration**: A data migration that updates existing `training_activities.xp_reward`
  values so that per-question XP is uniform within each activity group.
- **Progress**: A learner's level and accumulated XP for a training, stored in
  `user_training_progress` and keyed by training id.
- **Staged_Cutover**: The delivery approach in which data-driven read paths run alongside the
  existing hardcoded constants until parity is verified, after which the constants are
  removed.
- **Hardcoded_Constants**: The learner-facing constants to be removed at the final cleanup
  step: `skills`, `placeholderMissions`, `AVAILABLE_ACTIVITY_IDS`, and the slug constants
  (e.g. `CONTRADICTION_SPOTTING_SKILL_ID`).

## Requirements

### Requirement 1: Data-driven trainings enumeration

**User Story:** As a learner, I want the trainings I can practice to come from the database,
so that any training an educator has published (philosophy, economics, math, and others)
appears in my view alongside the existing one.

#### Acceptance Criteria

1. WHEN the Learner_UI loads, THE Trainings_Endpoint SHALL return, within 3 seconds, every
   `trainings` row whose `is_active` value is true, up to a maximum of 200 trainings per
   response.
2. WHEN the Trainings_Endpoint returns active trainings, THE Learner_UI SHALL render exactly
   one entry per returned training, displaying that training's stored id, slug, and title.
3. WHEN the Trainings_Endpoint returns more than one active training, THE Learner_UI SHALL
   render a distinct entry for each returned active training rather than a single fixed
   training.
4. WHEN the Trainings_Endpoint returns trainings, THE Trainings_Endpoint SHALL order them by
   a stored ordering field such that two consecutive requests over unchanged training data
   produce an identical training order.
5. IF the Trainings_Endpoint fails to return active trainings, THEN THE Learner_UI SHALL
   display an error indication that trainings could not be loaded and SHALL present a retry
   control that re-requests the active trainings.
6. IF the Trainings_Endpoint fails to return active trainings, THEN THE Learner_UI SHALL
   continue to render any training content that was successfully loaded before the failure.
7. WHEN the Trainings_Endpoint returns zero active trainings, THE Learner_UI SHALL display an
   empty state indicating that no trainings are currently available.
8. IF a returned training is missing a non-empty stored id, slug, or title, THEN THE
   Learner_UI SHALL omit that training's entry and SHALL continue rendering the remaining
   valid trainings.

### Requirement 2: Data-driven activity groups with group-scoped question loading

**User Story:** As a learner, I want each training to expand into its real activity groups
and each group to show only its own questions, so that I practice the specific skill I
selected instead of a mix of every question in the training.

#### Acceptance Criteria

1. WHEN a learner views a training, THE Activity_Groups_Endpoint SHALL return every
   `training_activity_groups` row whose `training_id` matches that training and whose
   `is_active` value is true, and SHALL exclude every row whose `is_active` value is false.
2. WHEN the Activity_Groups_Endpoint returns activity groups, THE Activity_Groups_Endpoint
   SHALL order them by ascending `display_order` value, and SHALL break ties between equal
   `display_order` values by ascending `slug`.
3. WHEN the Learner_UI renders the activity groups for a training, THE Learner_UI SHALL
   render one entry per returned activity group, in the order received, using the group's
   stored slug, title, and description.
4. WHEN a learner opens an activity group, THE Activity_Endpoint SHALL return only the
   `training_activities` rows whose `activity_group_id` matches the `activity_group_id`
   supplied in the request and whose `is_active` value is true.
5. WHEN the Activity_Endpoint returns activities for an activity group, THE Activity_Endpoint
   SHALL exclude every activity whose `activity_group_id` does not match the supplied
   `activity_group_id` and every activity whose `is_active` value is false.
6. IF a request to the Activity_Endpoint omits `activity_group_id` or supplies an
   `activity_group_id` that matches no active activity group within the training, THEN THE
   Activity_Endpoint SHALL return no activities and SHALL return an error response indicating
   the activity group was not found.
7. IF an activity group returned by the Activity_Endpoint contains zero active activities,
   THEN THE Learner_UI SHALL render that group with zero question entries and a visible
   empty-state indication, and SHALL render the remainder of the training without error.

### Requirement 3: Per-question uniform-within-group XP via data migration

**User Story:** As a product owner, I want XP to stay per question but be consistent within
each activity group, so that learners earn a predictable amount per question without adding a
group-level XP column to the schema.

#### Acceptance Criteria

1. WHEN the XP_Migration runs, THE XP_Migration SHALL update existing
   `training_activities.xp_reward` values so that every existing activity within the same
   activity group is assigned one identical `xp_reward` value.
2. WHEN the XP_Migration assigns per-question XP to activity groups identified by
   `display_order` in ascending order, THE XP_Migration SHALL set group 1 (Contradiction
   Spotting) to 10 XP per question, group 2 (Rule vs. Exception) to 25 XP per question,
   group 3 (Principle vs. Action) to 45 XP per question, group 4 (Universal vs. Edge Case)
   to 75 XP per question, and group 5 (Incompatible Belief Set) to 105 XP per question.
3. WHEN the XP_Migration modifies XP values, THE XP_Migration SHALL update existing
   `training_activities` rows only AND SHALL NOT add a group-level XP column, a leveling
   column, or any other schema column.
4. WHEN a learner answers a question correctly after the XP_Migration has completed, THE
   Activity_Endpoint submit path SHALL award exactly the group's normalized per-question
   `xp_reward` value for that question.
5. WHEN the XP_Migration runs, THE XP_Migration SHALL leave XP already earned by learners
   before the run unchanged so that normalized values apply only to awards granted after the
   migration completes.
6. IF the XP_Migration fails to update one or more targeted `training_activities` rows, THEN
   THE XP_Migration SHALL restore all `training_activities.xp_reward` values to their
   pre-migration state AND SHALL report the failure to the caller.
7. WHEN the XP_Migration runs more than once, THE XP_Migration SHALL produce the same
   `xp_reward` values as a single run AND SHALL NOT further modify rows that already hold
   their normalized value.

### Requirement 4: Data-driven missions listing

**User Story:** As a learner, I want the missions list to show the missions that have been
published, so that I can play missions an educator created rather than only a single
built-in mission.

#### Acceptance Criteria

1. WHEN the Learner_UI loads the missions list, THE Missions_Endpoint SHALL return every
   `missions` row whose `is_active` value is true AND SHALL exclude every `missions` row
   whose `is_active` value is false.
2. WHEN the Missions_Endpoint returns missions, THE Missions_Endpoint SHALL read the missions
   from the `missions` table rather than from the `wrongRecruitMission` constant.
3. WHEN the Missions_Endpoint responds, THE Missions_Endpoint SHALL NOT seed or upsert the
   wrong-recruit mission within the request handler, because the wrong-recruit content is
   already backfilled into `mission_body` by the authoring migration.
4. WHEN the Missions_Endpoint returns missions, THE Learner_UI SHALL render exactly one entry
   per returned mission using the mission's stored slug, title, and active state.
5. WHEN the Missions_Endpoint returns more than one mission, THE Missions_Endpoint SHALL order
   the missions by ascending stored `slug` so that two consecutive requests over unchanged
   mission data produce an identical mission order.
6. WHEN the Missions_Endpoint returns zero active missions, THE Learner_UI SHALL display an
   empty state indicating that no missions are currently available and SHALL render no mission
   entries.
7. IF the Missions_Endpoint fails to load active missions, THEN THE Missions_Endpoint SHALL
   return an error response without a partial mission list, AND THE Learner_UI SHALL display
   an error indication with a retry control that re-requests the active missions.

### Requirement 5: Training slug correction and progress keyed by training id

**User Story:** As a learner, I want my progress to track the correct training, so that the
XP and level I see belong to the training I am actually practicing.

#### Acceptance Criteria

1. THE Learner_UI SHALL identify the training using the stored slug `philosophical-reasoning`
   and the title "Philosophical Reasoning", and SHALL NOT use the slug `philosophical-thinking`
   or the title "Philosophical Thinking".
2. WHEN the Learner_UI requests Progress for a training, THE Learner_UI SHALL key that request
   by the training's id and SHALL NOT key it by the training's slug.
3. WHEN Progress is loaded for a training, THE Learner_UI SHALL display the level and XP
   associated with the matching training id.
4. WHEN the Learner_UI resolves a training from the Trainings_Endpoint, THE Learner_UI SHALL
   match the training by the id returned from the Trainings_Endpoint rather than by a
   hardcoded slug constant.
5. IF the Trainings_Endpoint returns no training whose slug matches `philosophical-reasoning`,
   THEN THE Learner_UI SHALL display an error indication that the training could not be found
   and SHALL NOT display any level or XP value.
6. IF no Progress record exists for the matching training id, THEN THE Learner_UI SHALL
   display the default starting level and an XP value of 0.

### Requirement 6: Staged cutover with parity verification before constant removal

**User Story:** As a maintainer, I want the data-driven read paths built and verified
alongside the existing hardcoded data before any constants are removed, so that the
learner-facing UI keeps working at every step and no content disappears during the change.

#### Acceptance Criteria

1. WHILE the data-driven read paths are being introduced, THE Learner_UI SHALL continue to
   render every published training, activity group, activity, and mission without a flag-day
   removal of the Hardcoded_Constants.
2. THE system SHALL define parity as: for every published training, activity group, activity,
   and mission, the data-driven read paths render the same set of entities and the same
   displayed content as the Hardcoded_Constants, with zero missing entities and zero extra
   entities.
3. WHEN parity as defined in criterion 2 is confirmed, THE system SHALL remove the
   Hardcoded_Constants `skills`, `placeholderMissions`, `AVAILABLE_ACTIVITY_IDS`, and the slug
   constants.
4. WHEN the Hardcoded_Constants are removed, THE Learner_UI SHALL source every rendered
   training, activity group, activity, and mission from the database read paths AND SHALL NOT
   reference any removed constant.
5. WHEN the cleanup step removes the placeholder activities, THE Learner_UI SHALL no longer
   render the two invented "coming soon" activity entries that have no corresponding published
   database content.
6. IF parity as defined in criterion 2 fails for any single entity, THEN THE system SHALL
   retain the Hardcoded_Constants so that the Learner_UI continues to render content.
