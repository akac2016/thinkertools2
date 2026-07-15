import assert from "node:assert/strict";
import test from "node:test";

import { buildDraftUpdatePatch } from "../lib/authoring/draft-update.ts";
import type { ContentDraft } from "../lib/authoring/draft-types.ts";

const GROUP_ID = "00000000-0000-4000-8000-000000000002";

function makeDraft(overrides: Partial<ContentDraft> = {}): ContentDraft {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    contentType: "activity",
    status: "valid",
    origin: "ai",
    primaryTrainingId: "00000000-0000-4000-8000-000000000003",
    activityGroupId: null,
    title: "Contradiction spotting",
    slug: null,
    body: {
      round_type: "activity_standard",
      question_text: "Which two claims contradict each other?",
      prompt_claims: [
        "A. The policy reduced emissions.",
        "B. The policy did not reduce emissions.",
        "C. The policy began last year.",
      ],
      correct_answer_labels: ["A", "B"],
      expected_answer_count: 2,
      explanation: "A and B make incompatible claims.",
    },
    validationIssues: [],
    aiSource: "openai",
    aiModel: "test-model",
    publishedRefId: null,
    createdBy: "00000000-0000-4000-8000-000000000004",
    createdAt: "2026-07-15T00:00:00.000Z",
    updatedAt: "2026-07-15T00:00:00.000Z",
    ...overrides,
  };
}

test("activity-group assignment changes only the assignment", () => {
  const patch = buildDraftUpdatePatch(makeDraft(), { activityGroupId: GROUP_ID });

  assert.deepEqual(patch, { activityGroupId: GROUP_ID });
});

test("activity-group removal changes only the assignment", () => {
  const patch = buildDraftUpdatePatch(makeDraft({ activityGroupId: GROUP_ID }), {
    activityGroupId: null,
  });

  assert.deepEqual(patch, { activityGroupId: null });
});

test("activity-group assignment does not reopen a published draft", () => {
  const patch = buildDraftUpdatePatch(makeDraft({ status: "published" }), {
    activityGroupId: GROUP_ID,
  });

  assert.deepEqual(patch, { activityGroupId: GROUP_ID });
});

test("authored edits still promote AI drafts to co-authored and revalidate", () => {
  const patch = buildDraftUpdatePatch(makeDraft(), {
    title: "Updated contradiction spotting",
  });

  assert.equal(patch.title, "Updated contradiction spotting");
  assert.equal(patch.origin, "co_authored");
  assert.equal(patch.status, "valid");
  assert.deepEqual(patch.validationIssues, []);
});
