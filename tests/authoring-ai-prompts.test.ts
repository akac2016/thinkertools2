import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAuthoringSystemPrompt,
  buildAuthoringUserPrompt,
  buildRefineSystemPrompt,
  buildRefineUserPrompt,
  buildAuthoringMock,
} from "../lib/authoring/ai-prompts.ts";

// ---------------------------------------------------------------------------
// buildAuthoringSystemPrompt
// ---------------------------------------------------------------------------

test("buildAuthoringSystemPrompt(activity) mentions schema fields", () => {
  const prompt = buildAuthoringSystemPrompt("activity");
  assert.ok(prompt.includes("prompt_claims"), "should mention prompt_claims");
  assert.ok(prompt.includes("correct_answer_labels"), "should mention correct_answer_labels");
  assert.ok(prompt.includes("expected_answer_count"), "should mention expected_answer_count");
  assert.ok(prompt.includes("explanation"), "should mention explanation");
});

test("buildAuthoringSystemPrompt(mission) mentions schema fields", () => {
  const prompt = buildAuthoringSystemPrompt("mission");
  assert.ok(prompt.includes("stages"), "should mention stages");
  assert.ok(prompt.includes("character_claims"), "should mention character_claims");
  assert.ok(prompt.includes("contradiction_review"), "should mention contradiction_review");
  assert.ok(prompt.includes("debrief"), "should mention debrief");
});

test("buildAuthoringSystemPrompt includes trainingContext when provided", () => {
  const prompt = buildAuthoringSystemPrompt("activity", "Year 9 science class");
  assert.ok(prompt.includes("Year 9 science class"), "should embed training context");
});

test("buildAuthoringSystemPrompt omits context block when not provided", () => {
  const prompt = buildAuthoringSystemPrompt("activity");
  assert.ok(!prompt.includes("Training context"), "should not include context block");
});

// ---------------------------------------------------------------------------
// buildAuthoringUserPrompt
// ---------------------------------------------------------------------------

test("buildAuthoringUserPrompt wraps description in user prompt", () => {
  const prompt = buildAuthoringUserPrompt("Create an activity about climate change.");
  assert.ok(prompt.includes("climate change"), "should include the description");
  assert.ok(prompt.includes("JSON"), "should instruct JSON output");
});

test("buildAuthoringUserPrompt trims whitespace from description", () => {
  const prompt = buildAuthoringUserPrompt("  spaced description  ");
  assert.ok(prompt.includes("spaced description"), "should include trimmed description");
});

// ---------------------------------------------------------------------------
// buildRefineSystemPrompt
// ---------------------------------------------------------------------------

test("buildRefineSystemPrompt(activity) instructs whole-object return", () => {
  const prompt = buildRefineSystemPrompt("activity");
  assert.ok(prompt.includes("COMPLETE"), "should require complete revised object");
  assert.ok(prompt.includes("activity"), "should reference content type");
});

test("buildRefineSystemPrompt(mission) instructs whole-object return", () => {
  const prompt = buildRefineSystemPrompt("mission");
  assert.ok(prompt.includes("COMPLETE"), "should require complete revised object");
  assert.ok(prompt.includes("mission"), "should reference content type");
});

test("buildRefineSystemPrompt instructs preserving unaddressed parts", () => {
  const prompt = buildRefineSystemPrompt("activity");
  assert.ok(
    prompt.toLowerCase().includes("preserve"),
    "should instruct preserving unaddressed parts",
  );
});

// ---------------------------------------------------------------------------
// buildRefineUserPrompt
// ---------------------------------------------------------------------------

test("buildRefineUserPrompt includes current body as JSON", () => {
  const body = { question_text: "Which claims contradict?", expected_answer_count: 2 };
  const prompt = buildRefineUserPrompt(body, "Make it harder.");
  assert.ok(prompt.includes('"question_text"'), "should include JSON-stringified body");
  assert.ok(prompt.includes("Make it harder"), "should include the instruction");
});

test("buildRefineUserPrompt trims instruction whitespace", () => {
  const prompt = buildRefineUserPrompt({}, "  add a claim  ");
  assert.ok(prompt.includes("add a claim"), "should include trimmed instruction");
});

// ---------------------------------------------------------------------------
// buildAuthoringMock — activity
// ---------------------------------------------------------------------------

test("buildAuthoringMock(activity) returns required fields", () => {
  const mock = buildAuthoringMock("activity", "Identify contradictions about vaccines.") as Record<string, unknown>;
  assert.equal(mock.round_type, "activity_standard");
  assert.ok(typeof mock.question_text === "string" && mock.question_text.length > 0);
  assert.ok(Array.isArray(mock.prompt_claims) && (mock.prompt_claims as unknown[]).length >= 2);
  assert.ok(Array.isArray(mock.correct_answer_labels) && (mock.correct_answer_labels as unknown[]).length >= 1);
  assert.ok(typeof mock.explanation === "string" && mock.explanation.length > 0);
  assert.ok(mock.expected_answer_count === 1 || mock.expected_answer_count === 2);
});

test("buildAuthoringMock(activity) correct_answer_labels count matches expected_answer_count", () => {
  const mock = buildAuthoringMock("activity", "Climate change debate.") as Record<string, unknown>;
  const labels = mock.correct_answer_labels as string[];
  const count = mock.expected_answer_count as number;
  assert.equal(labels.length, count);
});

test("buildAuthoringMock(activity) correct_answer_labels reference existing claim positions", () => {
  const mock = buildAuthoringMock("activity", "Nutrition myths.") as Record<string, unknown>;
  const claims = mock.prompt_claims as string[];
  const labels = mock.correct_answer_labels as string[];
  // Labels are single uppercase letters A, B, C... corresponding to claim positions
  const validLabels = claims.map((_, i) => String.fromCharCode(65 + i));
  for (const label of labels) {
    assert.ok(validLabels.includes(label), `label ${label} should correspond to a claim`);
  }
});

test("buildAuthoringMock(activity) is deterministic for same inputs", () => {
  const a = buildAuthoringMock("activity", "Vaccines and immunity.");
  const b = buildAuthoringMock("activity", "Vaccines and immunity.");
  assert.deepEqual(a, b);
});

test("buildAuthoringMock(activity) derives content from description", () => {
  const mock = buildAuthoringMock("activity", "photosynthesis plants sunlight") as Record<string, unknown>;
  const text = JSON.stringify(mock).toLowerCase();
  // At least one keyword from the description should appear in the output
  const hasKeyword = ["photosynthesis", "plants", "sunlight"].some((kw) => text.includes(kw));
  assert.ok(hasKeyword, "mock content should be derived from description keywords");
});

// ---------------------------------------------------------------------------
// buildAuthoringMock — mission
// ---------------------------------------------------------------------------

test("buildAuthoringMock(mission) returns required top-level fields", () => {
  const mock = buildAuthoringMock("mission", "Investigate a corporate cover-up.") as Record<string, unknown>;
  assert.ok(typeof mock.narrative_hook === "string" && mock.narrative_hook.length > 0);
  assert.ok(typeof mock.short_description === "string" && mock.short_description.length > 0);
  assert.ok(typeof mock.difficulty_label === "string");
  assert.ok(typeof mock.required_training_level === "number");
  assert.ok(typeof mock.xp_reward === "number");
  assert.ok(Array.isArray(mock.stages) && (mock.stages as unknown[]).length >= 2);
  assert.ok(Array.isArray(mock.actions) && (mock.actions as unknown[]).length >= 1);
  assert.ok(Array.isArray(mock.character_claims) && (mock.character_claims as unknown[]).length >= 2);
  assert.ok(Array.isArray(mock.resolution_options) && (mock.resolution_options as unknown[]).length >= 2);
});

test("buildAuthoringMock(mission) action stageIds reference existing stages", () => {
  const mock = buildAuthoringMock("mission", "A spy thriller.") as Record<string, unknown>;
  const stages = mock.stages as Array<{ id: string }>;
  const actions = mock.actions as Array<{ stageId: string; targetStageId: string | null }>;
  const stageIds = new Set(stages.map((s) => s.id));
  for (const action of actions) {
    assert.ok(stageIds.has(action.stageId), `action.stageId ${action.stageId} must reference a stage`);
    if (action.targetStageId !== null) {
      assert.ok(stageIds.has(action.targetStageId), `action.targetStageId ${action.targetStageId} must reference a stage`);
    }
  }
});

test("buildAuthoringMock(mission) contradiction_review labels reference character_claims", () => {
  const mock = buildAuthoringMock("mission", "Medical ethics dilemma.") as Record<string, unknown>;
  const claims = mock.character_claims as Array<{ label: string }>;
  const review = mock.contradiction_review as { correct_claim_labels: string[] };
  const claimLabels = new Set(claims.map((c) => c.label));
  for (const label of review.correct_claim_labels) {
    assert.ok(claimLabels.has(label), `contradiction label ${label} must reference a character claim`);
  }
});

test("buildAuthoringMock(mission) resolution_review best_option_id references resolution_options", () => {
  const mock = buildAuthoringMock("mission", "Environmental policy.") as Record<string, unknown>;
  const options = mock.resolution_options as Array<{ id: string }>;
  const review = mock.resolution_review as { best_option_id: string };
  const optionIds = new Set(options.map((o) => o.id));
  assert.ok(optionIds.has(review.best_option_id), "best_option_id must reference a resolution option");
});

test("buildAuthoringMock(mission) is deterministic for same inputs", () => {
  const a = buildAuthoringMock("mission", "A detective story.");
  const b = buildAuthoringMock("mission", "A detective story.");
  assert.deepEqual(a, b);
});

test("buildAuthoringMock(mission) has a complete action kind", () => {
  const mock = buildAuthoringMock("mission", "Space exploration.") as Record<string, unknown>;
  const actions = mock.actions as Array<{ kind: string }>;
  const hasComplete = actions.some((a) => a.kind === "complete");
  assert.ok(hasComplete, "mission mock must have at least one action with kind 'complete'");
});

// ---------------------------------------------------------------------------
// buildAuthoringMock — edge cases
// ---------------------------------------------------------------------------

test("buildAuthoringMock(activity) handles empty description gracefully", () => {
  const mock = buildAuthoringMock("activity", "") as Record<string, unknown>;
  assert.ok(typeof mock.question_text === "string" && mock.question_text.length > 0);
  assert.ok(Array.isArray(mock.prompt_claims));
});

test("buildAuthoringMock(mission) handles empty description gracefully", () => {
  const mock = buildAuthoringMock("mission", "") as Record<string, unknown>;
  assert.ok(typeof mock.narrative_hook === "string" && mock.narrative_hook.length > 0);
  assert.ok(Array.isArray(mock.stages));
});
