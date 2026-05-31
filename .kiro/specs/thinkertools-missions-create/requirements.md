# Requirements Document

## Introduction

ThinkerTools Missions Create is an educator authoring experience for creating new
ThinkerTools training content — both **activities** (skill-practice drills) and
**missions** (multi-stage, story-driven flows). Educators can author content directly,
or describe what they want in plain language and have an AI drafting layer convert that
description into the structured content the ThinkerTools Missions system already grades and
runs against. Authorship is flexible: a draft may be fully human-authored, fully
AI-drafted, or a joint human-and-AI effort. The product schema remains the source of
truth — the AI is an optional drafting and reasoning layer, and the educator stays in
control by reviewing, editing, previewing, and approving content before it is published.

This document scopes the **authoring feature only**. It is designed to be verification-aware
so that an automated browser playtest layer (Kane CLI) can be added later without rework,
but that verification layer is explicitly out of scope here and is captured as a future
phase at the end of this document.

Two structural decisions are required up front because every later capability — preview,
approval, and future automated playtesting — depends on them:

1. **Drafts are playable by URL.** Any authored content can be opened and played at a
   stable address while still in a non-published (draft) state.
2. **Draft vs. published lifecycle.** Authored content has an explicit lifecycle so that
   unreviewed content is never visible to learners and there is a clear seam where review,
   approval, and (later) automated verification occur.

This release also generalizes the existing contradiction-grading assumption of exactly two
correct answers, so authored activities may have a variable number of correct answers.

### Scope (this release)

- In scope: creating activity and mission drafts via direct (manual) authoring,
  AI-assisted natural-language drafting, or a combination of both; **single-shot generation**
  (one description → a full structured draft) and **conversational refinement** (multi-turn
  natural-language instructions that revise an existing draft); schema validation of drafts;
  draft/published lifecycle; playable-by-URL draft preview; educator review/edit/approve UI;
  variable correct-answer cardinality for contradiction-style activities.
- Out of scope: automated Kane CLI playtest/verification (captured as a future phase);
  community publishing/remixing; difficulty auto-tuning; AI regeneration loops driven by
  playtest results; skills/training-track creation beyond attaching content to an existing
  training.

## Glossary

- **Activity**: A skill-practice drill (e.g. a contradiction-spotting round) stored as a
  `training_activities` row, graded by the submit endpoint.
- **Mission**: A multi-stage, story-driven flow (e.g. "The Wrong Recruit") composed of
  stages, actions, claims, a contradiction review, a resolution choice, and a debrief.
- **round_content**: The structured JSON on a `training_activities` row that the grading
  logic reads (claims, correct answer labels, question text, explanation).
- **Draft**: Not-yet-published content authored through this feature, regardless of
  origin (human-authored, AI-drafted, or co-authored).
- **Published**: Content that has been approved and is visible/playable to learners.
- **Cardinality**: The number of correct answer labels a contradiction activity expects.
- **Single-shot generation**: One natural-language description produces a complete
  structured draft in a single AI call.
- **Conversational refinement**: A multi-turn exchange in which the educator gives
  natural-language instructions ("make it harder", "add a fourth claim") that revise an
  existing draft, turn by turn.

## Requirements

### Requirement 1: Create content drafts (manual, AI-assisted, or co-authored)

**User Story:** As an educator, I want to create activity and mission drafts by writing
them myself, by describing them in natural language for the AI to draft, or by combining
both, so that I can author content the way that suits me without being forced into an
AI-only or manual-only workflow.

#### Acceptance Criteria

1. WHEN an educator chooses to create new content THEN the system SHALL allow the educator
   to select a content type of activity or mission.
2. WHEN an educator authors content directly THEN the system SHALL accept structured field
   values entered by the educator and persist them as a draft, without requiring any AI
   involvement.
3. WHEN an educator provides a natural-language description for AI assistance AND selects a
   content type of activity THEN the system SHALL produce, in a single generation, draft
   fields the activity requires (question text, prompt claims with unique labels, correct
   answer labels, explanation, and presentation metadata).
4. WHEN an educator provides a natural-language description for AI assistance AND selects a
   content type of mission THEN the system SHALL produce, in a single generation, draft
   fields the mission requires (narrative hook, ordered stages, actions with stage
   transitions, character claims, a contradiction review, resolution options, a resolution
   review, and a debrief).
5. WHEN AI-drafted fields are produced THEN the educator SHALL be able to edit any of them,
   so that AI output is a starting point rather than a final result.
6. WHEN a draft is persisted THEN the system SHALL record its authorship origin (manual,
   AI-assisted, or co-authored) for attribution and later review.
7. WHEN any draft is persisted THEN the system SHALL store it in a draft (non-published)
   state so it is not visible to learners, regardless of how it was authored.

### Requirement 2: Optional AI drafting uses the existing structured-output client

**User Story:** As a maintainer, I want the optional AI drafting path to reuse the app's
existing AI infrastructure, so that the feature is consistent, observable, and does not
introduce a parallel AI stack.

#### Acceptance Criteria

1. WHEN the system generates draft fields with AI THEN it SHALL use the existing
   structured-AI client so that output is constrained to a schema rather than free text.
2. WHEN AI draft fields are generated THEN the system SHALL default to the application's
   configured default model AND SHALL allow the model to be overridden per request.
3. WHEN the AI call cannot be completed and a deterministic fallback is returned THEN the
   system SHALL record that the draft came from a fallback source rather than a live model.
4. WHEN a draft is presented to the educator THEN the system SHALL make the draft's source
   (live model vs. fallback) available so the educator knows whether they are reviewing
   real generated content.
5. WHEN an educator's natural-language description is too vague for the AI to produce
   complete draft fields THEN the system SHALL return a recoverable message identifying
   which fields could not be drafted rather than persisting incomplete or invalid fields.

### Requirement 3: Conversational refinement of a draft

**User Story:** As an educator, I want to refine an existing draft through natural-language
instructions over multiple turns, so that I can collaboratively shape the content ("make it
harder", "change the setting", "add a fourth claim") instead of editing every field by hand.

#### Acceptance Criteria

1. WHEN an educator issues a natural-language instruction against an existing draft THEN the
   system SHALL produce a revised draft that applies the requested change while preserving
   the parts of the draft the instruction did not address.
2. WHEN a refinement is produced THEN its output SHALL conform to the same schema as the
   content type, so that a refined draft is never less valid in shape than a generated one.
3. WHEN an educator issues a sequence of refinement instructions THEN the system SHALL apply
   them cumulatively, each turn operating on the most recent draft state.
4. WHEN a refinement instruction is ambiguous or cannot be applied THEN the system SHALL
   return a recoverable message and SHALL leave the existing draft unchanged.
5. WHEN a draft is refined by AI THEN the system SHALL update its authorship origin to
   reflect AI involvement (AI-assisted or co-authored) consistent with Requirement 1.
6. WHEN a refinement turn occurs THEN the educator SHALL still be able to manually edit any
   field afterward, so conversational and manual editing remain interchangeable.

### Requirement 4: Schema validation of drafts

**User Story:** As a product owner, I want every draft validated against the content schema
before it can be previewed or published, so that malformed content never reaches a learner.

#### Acceptance Criteria

1. WHEN an activity draft is saved THEN the system SHALL validate that it has at least two
   prompt claims with unique labels and that every correct answer label references an
   existing claim label.
2. WHEN a mission draft is saved THEN the system SHALL validate that every action's target
   stage references an existing stage, that there is a reachable path from the first stage
   to the debrief, and that the contradiction and resolution reviews reference existing
   claims/options.
3. IF a draft fails schema validation THEN the system SHALL block preview and publication
   AND SHALL return the specific validation errors.
4. WHEN a draft passes schema validation THEN the system SHALL mark it valid and eligible
   for preview and approval.

### Requirement 5: Variable correct-answer cardinality

**User Story:** As an educator, I want to author contradiction activities that have a
number of correct answers other than exactly two, so that I can write problems that are not
artificially constrained to a single shape.

#### Acceptance Criteria

1. WHEN a contradiction activity declares an expected correct-answer count THEN the grading
   logic SHALL compare the learner's selection against the stored correct labels using that
   declared count rather than a hard-coded value of two.
2. WHEN the submit endpoint receives a selection THEN it SHALL accept a number of selected
   labels equal to the activity's declared correct-answer count.
3. WHEN an activity's declared correct-answer count is outside the supported range THEN the
   system SHALL treat the activity as misconfigured and reject the submission with a
   configuration error.
4. WHEN existing activities that expect two correct answers are graded THEN they SHALL
   continue to grade correctly with no behavior change.
5. WHEN an activity expects a single correct answer THEN the question text and selection UI
   SHALL reflect that a single selection is expected.

### Requirement 6: Draft and published lifecycle

**User Story:** As a product owner, I want authored content to move through an explicit
draft-to-published lifecycle, so that unreviewed content is never shown to learners and
there is a clear point where approval (and later, automated verification) occurs.

#### Acceptance Criteria

1. WHEN content is authored THEN it SHALL be created in a draft state that is excluded from
   the learner-facing activity and mission listings.
2. WHEN content is in a draft state THEN it SHALL NOT be counted toward learner progress or
   XP through normal play.
3. WHEN an educator publishes a draft THEN the system SHALL require that the draft has
   passed schema validation before the state transition is allowed.
4. WHEN a draft is published THEN it SHALL become visible and playable to learners through
   the existing listings.
5. WHEN a published item is later edited THEN the system SHALL return it to a draft state
   requiring re-validation before it is published again.

### Requirement 7: Playable-by-URL draft preview

**User Story:** As an educator, I want to open and play a draft at a stable URL before
publishing it, so that I can experience it as a learner would and so that automated
verification can target it later.

#### Acceptance Criteria

1. WHEN a draft exists THEN the system SHALL expose it at a stable address that uniquely
   identifies that draft.
2. WHEN an authorized educator opens a draft's address THEN the system SHALL render and
   allow play of the draft exactly as a learner would experience the published version.
3. WHEN a draft is played through its preview address THEN the system SHALL NOT award XP or
   record learner progress against the educator's account.
4. WHEN an unauthorized user requests a draft's address THEN the system SHALL deny access.

### Requirement 8: Educator review, edit, and approval

**User Story:** As an educator, I want to review, edit, preview, and approve a draft, so
that I stay in control of content quality.

#### Acceptance Criteria

1. WHEN a draft is generated THEN the system SHALL present all drafted fields to the
   educator in an editable form.
2. WHEN an educator edits any field THEN the system SHALL persist the edited values as the
   current draft state AND SHALL re-run schema validation.
3. WHEN an educator requests a preview THEN the system SHALL open the draft's playable
   preview address.
4. WHEN an educator approves a draft that has passed schema validation THEN the system
   SHALL publish it.
5. WHEN an educator attempts to approve a draft that has not passed schema validation THEN
   the system SHALL prevent publication AND SHALL indicate what must be fixed.

## Future phase: automated browser verification (out of scope)

This phase is documented to keep the design verification-aware; it is not part of this
release and will be specified separately.

A later phase will add an automated playtest layer in which Kane CLI plays a draft through
its stable preview address as a learner and asserts objective, browser-observable facts —
for example that a mission is completable end to end (every stage reachable through to the
debrief), that authored content renders and is selectable, that grading accepts the keyed
answer, and that completion awards XP. The draft/published lifecycle (Requirement 6) and
the playable-by-URL preview (Requirement 7) are the integration seams that make this phase
possible without rework. Subjective or aesthetic judgment (whether content is "confusing"
or visually pleasing) is explicitly excluded from the planned verification scope, which
will be limited to checks that have an objective ground truth.
