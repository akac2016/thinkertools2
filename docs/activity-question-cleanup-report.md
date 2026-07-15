# Activity Question Cleanup Report

Status: Preliminary; no data mutations approved or performed.

Audit date: 2026-07-15

Scope: Ticket 10 in `activity-question-authoring-tickets.md`.

## Evidence Received

The draft-label audit returned seven unpublished activity drafts, all owned by
the same educator and belonging to the `Philosophical Reasoning` subject.

- No result has a `published_ref_id`.
- No result is learner-facing.
- Two drafts have no question text and appear empty.
- Five drafts contain meaningful questions but use the repeated generic title
  `Philosophical Reasoning`.

The suspicious activity-group summary (Query 1) has not yet been received, so
group cleanup remains unassessed.

## Proposed Draft Actions

These are recommendations for review, not approved mutations.

| Draft ID | Current group | Current state | Proposed action | Proposed title | Reason |
| --- | --- | --- | --- | --- | --- |
| `778934f6-5e54-47aa-96b0-8b3b21f322de` | Contradiction Spotting | Draft; blank title and no question | Archive | — | Empty draft; archiving is reversible |
| `0dec5224-6b7d-47c6-aeed-7ddfd4d86fdd` | Contradiction Spotting | Draft; generic title and no question | Archive | — | Empty draft; archiving is reversible |
| `445e1e65-d68a-426b-953b-b73885f27ee6` | Ungrouped | Valid AI draft | Rename only | Conflicting Ethical Perspectives | Gives the meaningful draft a distinguishable label |
| `2fa060b1-df61-48e4-b539-c42981fee000` | Ethical Schools of Thought | Valid co-authored draft | Rename only | Contradictory Ethical Frameworks | Preserves content and group assignment |
| `2aa7771d-2b9b-44f0-b054-1b1d8507f8be` | Ungrouped | Valid AI draft | Rename only | Contradictory Claims | Gives the meaningful draft a distinguishable label |
| `e330dbab-9ed6-43ab-aac0-b07f4b3449b6` | Ungrouped | Valid AI draft | Rename only | Dualism vs. Physicalism | Uses the actual question topic |
| `74d30ee3-41d9-4339-9f4a-f304e8392306` | Ethical Schools of Thought | Valid AI draft | Rename only | Conflicting Philosophical Theories | Preserves content and group assignment |

## Safety Notes

- Prefer `status = 'archived'` over deleting the two empty drafts.
- Rename operations should update only `content_drafts.title`.
- Do not change question bodies, group assignments, publication state, or
  published activity rows as part of these renames.
- Capture the current values in the eventual mutation script so every change
  has an explicit rollback statement.

## Remaining Before Cleanup Approval

1. Run Query 1 from `activity-question-cleanup-audit.sql` and add the suspicious
   activity-group results to this report.
2. If Query 1 flags populated groups, run Query 3 to inspect their contents.
3. Review the proposed draft titles and group actions with the product owner.
4. Prepare a transaction-wrapped mutation and rollback script for only the
   approved rows.
5. Run a post-change verification query before considering Ticket 10 complete.
