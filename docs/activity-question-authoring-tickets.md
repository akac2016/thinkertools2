# Activity Question Authoring Tickets

Scope: educator creation flow for activity questions in `/thinkertools-missions-create`.
Goal: support intentional activity-group placement without recreating prompt-derived category clutter.

## Product Decisions
- Activity questions belong to one subject training and one activity group.
- Activity groups are educator-confirmed organization under a subject training.
- A teacher may draft activity questions before choosing an activity group.
- Publishing requires an activity group.
- LLM may suggest group placement or group names, but must not assign or create groups without teacher confirmation.
- Multi-question generation is constrained to one confirmed activity group at a time.
- The lower authoring area should stay compact, with separate `Activity Groups` and `Drafts` sections.

## Ticket 1: Define Activity Question Authoring State Model
- Priority: P0
- Why: The create flow needs clear rules for when group assignment is optional, required, or locked.
- Problem: Current behavior has swung between silent auto-grouping and premature group prompts.
- Proposed change:
  - Document and encode the states:
    - subject selected
    - activity format selected
    - exploratory ungrouped draft allowed
    - needs activity group
    - group selected
    - ready for multi-question generation
    - ready to publish
  - Allow ungrouped activity drafts without creating or assigning a group.
- Acceptance criteria:
  - Activity authoring cannot silently create prompt-derived groups.
  - Ungrouped drafts are visibly marked `Needs activity group`.
  - Publishing is blocked until a group is assigned.

Implementation note: The overlapping authoring states and capabilities are
derived centrally in `lib/authoring/activity-authoring-state.ts`. Ungrouped
drafts support one exploratory question, while additional-question generation
and publishing require a confirmed activity group.

## Ticket 2: Add Read-Only Subject Workspace Below Authoring
- Priority: P0
- Why: Teachers need to see existing groups and drafts before the product asks them to make grouping decisions.
- Problem: The lower area currently behaves primarily as a draft list, so activity groups are not discoverable.
- Proposed change:
  - Replace/extend `Your drafts` with a read-only subject workspace containing two compact sections:
    - `Activity Groups`
    - `Drafts`
  - Show activity groups for the selected subject training.
  - Show lightweight metadata for each group, such as question count and status counts if available.
  - Allow a read-only expand/open interaction to preview contained questions if this can be done without introducing assignment controls.
  - Keep empty states lightweight.
  - Do not add group assignment, group creation, or AI suggestion behavior in this ticket.
- Acceptance criteria:
  - Selecting a subject shows its activity groups in the lower workspace.
  - Drafts remain visible separately from activity groups.
  - Existing questions can be inspected read-only, or the ticket documents why preview is deferred to Ticket 3.
  - No UI in this ticket assigns drafts to groups or creates groups.
  - The screen does not become a large curriculum dashboard.

Implementation note: Group rows now expand into a compact, scrollable,
read-only question preview. Ticket 3 still owns the eventual direct
`Add question here` action.

## Ticket 3: Add Activity Group Preview
- Priority: P1
- Why: Group names alone may not tell teachers where a question belongs.
- Problem: Educators need to inspect existing questions before assigning new questions.
- Proposed change:
  - Let educators open an activity group from the workspace.
  - Show contained questions/items with status labels where relevant.
  - Include a clear `Add question here` action.
- Acceptance criteria:
  - Educator can inspect questions in an existing group before choosing it.
  - Educator can start adding a question directly from a group.
  - Preview shows live content plus relevant draft/pending items with clear labels.

## Ticket 4: Support Explicit Group Assignment For Activity Drafts
- Priority: P0
- Why: Group placement is required product structure, but should be teacher-confirmed.
- Problem: Drafts need a reliable way to move from `Needs activity group` to a confirmed group.
- Proposed change:
  - Add UI for assigning an activity draft to:
    - existing activity group
    - newly named activity group
  - Do not create the new group until the teacher confirms the name.
  - Preserve subject training assignment unless the teacher confirms a subject switch.
- Acceptance criteria:
  - Ungrouped activity drafts display `Needs activity group`.
  - Teacher can assign the draft to an existing group.
  - Teacher can create and assign a new group intentionally.
  - Assignment updates the draft without regenerating the question.

Implementation note: The activity editor now provides explicit `Assign` and
`Create & assign` controls for ungrouped drafts. The update API verifies that
the selected group belongs to the draft's training subject and changes only the
draft's group assignment.

## Ticket 5: Allow Exploratory Ungrouped Questions
- Priority: P0
- Why: Some teachers arrive with a question in mind but no group structure yet.
- Problem: Requiring group placement too early may block useful exploration.
- Proposed change:
  - After subject + activity format, let the teacher describe/paste questions before group selection.
  - Save/generated draft is marked `Needs activity group`.
  - Show a nudge after each ungrouped draft:
    - `This draft needs an activity group before you publish it.`
- Acceptance criteria:
  - Teacher can create ungrouped questions without choosing a group first.
  - The draft is visibly ungrouped.
  - The teacher receives a clear, timely prompt to assign a group.

## Ticket 6: Constrain Multi-Question Generation To One Confirmed Group
- Priority: P0
- Why: Multiple generated questions should be coherent and share one destination.
- Problem: Generating multiple questions before group assignment risks mixed/disparate batches.
- Proposed change:
  - If a group is selected, allow multi-question generation for that group.
  - If no group is selected, generate at most one exploratory question.
  - If the teacher asks for multiple questions without a group, explain the constraint and ask them to choose/create a group first.
- Acceptance criteria:
  - Multi-question generation is unavailable without a confirmed activity group.
  - Generated batches are attached to exactly one group.
  - The UI explains why grouping is required for batches.

## Ticket 7: Add AI Group Suggestions As Confirmation-Only Assistance
- Priority: P1
- Product decision: Skip this ticket. Group placement should remain an
  intentional teacher decision rather than an AI recommendation.
- Why: Teachers may not know which group fits a question after drafting it.
- Problem: AI suggestions can help, but definitive AI grouping can create inaccurate structure.
- Proposed change:
  - Add a `Suggest group` action for ungrouped drafts.
  - Suggest:
    - likely existing group(s)
    - optional new group name(s)
    - possible subject mismatch if relevant
  - Show rationale and require teacher confirmation.
- Acceptance criteria:
  - AI suggestions do not directly assign or create groups.
  - Teacher can accept an existing group suggestion.
  - Teacher can edit/confirm a new group name before creation.
  - Rejected suggestions leave the draft unchanged.

## Ticket 8: Add Batch Intake Guardrails For Pasted Mixed Questions
- Priority: P1
- Why: Teachers may paste several questions at once before knowing whether they belong together.
- Problem: The app needs to avoid saving a mixed batch into one accidental group.
- Proposed change:
  - Detect or ask when input appears to contain multiple questions.
  - Ask whether they belong in the same group.
  - If yes, require one confirmed group before generating/saving the batch.
  - If no, save nothing and ask the teacher to split the questions into
    intentional sets, then manually assign each set to an activity group.
  - Do not suggest, create, or assign groups without an explicit teacher choice.
- Acceptance criteria:
  - Pasted multi-question input does not silently become one unreviewed mixed batch.
  - Teacher can confirm all questions belong together.
  - A confirmed batch cannot be generated or saved until the teacher chooses
    one existing group or intentionally names and creates a new group.
  - If the questions do not belong together, no drafts or groups are created.
  - The teacher is directed to separate and manually place the questions; no AI
    grouping suggestion is offered.

Implementation note: Guided authoring and the activity editor detect pasted
question lists and pause before saving. The teacher must confirm that the
questions belong together, then explicitly choose or create one activity group.
Confirmed batches create separate drafts in that one group. Declined batches
leave the drafts and groups unchanged.

## Ticket 9: Preserve Subject-Shift Guardrails During Group Assignment
- Priority: P1
- Why: A question may belong to a different subject training than the one selected.
- Problem: Group assignment should not mask a subject mismatch.
- Proposed change:
  - Keep existing subject-shift check before final draft creation or batch generation.
  - If a subject switch is confirmed, clear any group selection from the previous subject.
  - Require group assignment under the confirmed subject.
- Acceptance criteria:
  - Existing-group choices are scoped to the active subject.
  - Confirmed subject switches cannot keep a stale group from another subject.
  - Declined switches continue under the original subject.

## Ticket 10: Clean Up Existing Prompt-Derived Groups And Draft Labels
- Priority: P2
- Why: Existing data contains clutter from previous behavior.
- Problem: Old groups/drafts such as `New Category` and prompt-fragment labels will remain visible unless cleaned.
- Proposed change:
  - Identify suspicious activity groups:
    - `New Category`
    - repeated generated phrase labels
    - empty/pending groups with no meaningful content
  - Prepare a reviewed cleanup plan before any data mutation.
  - Merge, rename, archive, or delete only after explicit approval.
- Acceptance criteria:
  - A report lists affected groups/drafts before changes.
  - Cleanup actions are reversible or explicitly approved.
  - No live learner-facing content is removed accidentally.

---

## Suggested Delivery Sequence
1. Tickets 1, 4, 5, and 6: establish the state model and core guardrails.
2. Ticket 2: make groups and drafts visible in the authoring workspace.
3. Ticket 3: add group preview and direct add-to-group workflow.
4. Tickets 7 and 8: add AI assistance and batch handling after deterministic flow is stable.
5. Ticket 9: verify subject-shift behavior across the new group workflow.
6. Ticket 10: clean existing clutter after the new behavior is shipped.
