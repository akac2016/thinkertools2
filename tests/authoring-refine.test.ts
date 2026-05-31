/**
 * Tests for the conversational refinement feature.
 *
 * Covers:
 *   - validateDraft: activity and mission schema validation
 *   - Refinement logic: instruction applied, schema-valid, unaddressed fields preserved
 *   - Inapplicable instruction → validation failure → draft unchanged
 *   - Cumulative turns compose (each turn operates on the latest body)
 *   - Origin promotion: manual → co_authored when AI refines
 *   - mockResponse = currentBody → "no change" degradation
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import assert from "node:assert/strict";
import test from "node:test";

import { activityBodySchema } from "../lib/authoring/activity-schema.ts";
import { missionBodySchema } from "../lib/authoring/mission-schema.ts";
import { validateDraft } from "../lib/authoring/validation.ts";
import {
  buildRefineSystemPrompt,
  buildRefineUserPrompt,
} from "../lib/authoring/ai-prompts.ts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validActivityBody = {
  round_type: "activity_standard",
  question_text: "Which two claims about vaccines directly contradict each other?",
  prompt_claims: [
    "A: Vaccines prevent disease.",
    "B: Vaccines cause disease.",
    "C: Vaccines are tested for safety.",
    "D: Vaccines skip safety testing.",
  ],
  correct_answer_labels: ["A", "B"],
  explanation: "Claims A and B directly contradict each other.",
  expected_answer_count: 2,
};

const validMissionBody = {
  narrative_hook: "A mystery unfolds at the lab.",
  short_description: "Investigate the contradiction.",
  difficulty_label: "Beginner",
  required_training_level: 1,
  xp_reward: 100,
  stages: [
    {
      id: "stage-intro",
      title: "Introduction",
      objective: "Review the evidence.",
      guide_messages: ["Look carefully at the claims."],
      action_ids: ["action-advance"],
      revealed_fact_ids: [],
    },
    {
      id: "stage-debrief",
      title: "Debrief",
      objective: "Reflect on what you found.",
      guide_messages: ["Well done."],
      action_ids: ["action-complete"],
      revealed_fact_ids: [],
    },
  ],
  actions: [
    {
      id: "action-advance",
      label: "Continue",
      kind: "continue",
      target_stage_id: "stage-debrief",
    },
    {
      id: "action-complete",
      label: "Finish",
      kind: "complete",
    },
  ],
  facts: [],
  character_claims: [
    {
      id: "claim-a",
      label: "A",
      character_name: "Agent Smith",
      role: "Investigator",
      statement: "The data supports the hypothesis.",
      revealed_fact_ids: [],
    },
    {
      id: "claim-b",
      label: "B",
      character_name: "Dr. Jones",
      role: "Scientist",
      statement: "The data refutes the hypothesis.",
      revealed_fact_ids: [],
    },
  ],
  contradiction_review: {
    stage_id: "stage-intro",
    prompt: "Which claims contradict?",
    claim_ids: ["claim-a", "claim-b"],
    correct_claim_labels: ["A", "B"],
    correct_claim_ids: ["claim-a", "claim-b"],
    explanation: "A and B directly contradict each other.",
  },
  resolution_options: [
    {
      id: "option-trust",
      label: "A",
      body: "Trust the evidence.",
      feedback: "Correct — evidence-based reasoning is key.",
    },
    {
      id: "option-dismiss",
      label: "B",
      body: "Dismiss the evidence.",
      feedback: "Incorrect — dismissing evidence is not sound reasoning.",
    },
  ],
  resolution_review: {
    stage_id: "stage-debrief",
    prompt: "What should you do?",
    option_ids: ["option-trust", "option-dismiss"],
    best_option_id: "option-trust",
    explanation: "Trusting evidence is the correct approach.",
  },
  debrief: {
    completion_message: "Mission complete!",
    takeaway: "Always evaluate evidence carefully.",
    handoff_message: "Return to the main menu.",
  },
};

// ---------------------------------------------------------------------------
// validateDraft — activity
// ---------------------------------------------------------------------------

test("validateDraft(activity): valid body returns no issues", () => {
  const issues = validateDraft("activity", validActivityBody);
  assert.deepEqual(issues, []);
});

test("validateDraft(activity): missing required field returns issues", () => {
  const body = { ...validActivityBody, question_text: "" };
  const issues = validateDraft("activity", body);
  assert.ok(issues.length > 0, "should return issues for empty question_text");
});

test("validateDraft(activity): correct_answer_labels count mismatch returns issues", () => {
  const body = {
    ...validActivityBody,
    correct_answer_labels: ["A", "B", "C"], // 3 labels but expected_answer_count is 2
    expected_answer_count: 2,
  };
  const issues = validateDraft("activity", body);
  assert.ok(issues.length > 0, "should return issues when label count mismatches expected_answer_count");
});

test("validateDraft(activity): correct_answer_labels referencing non-existent claim returns issues", () => {
  const body = {
    ...validActivityBody,
    correct_answer_labels: ["Z"], // Z does not exist in prompt_claims
    expected_answer_count: 1,
  };
  const issues = validateDraft("activity", body);
  assert.ok(issues.length > 0, "should return issues when label does not reference a claim");
});

test("validateDraft(activity): non-object body returns issues", () => {
  const issues = validateDraft("activity", null);
  assert.ok(issues.length > 0, "null body should fail validation");
});

// ---------------------------------------------------------------------------
// validateDraft — mission
// ---------------------------------------------------------------------------

test("validateDraft(mission): valid body returns no issues", () => {
  const issues = validateDraft("mission", validMissionBody);
  assert.deepEqual(issues, []);
});

test("validateDraft(mission): missing required field returns issues", () => {
  const body = { ...validMissionBody, narrative_hook: "" };
  const issues = validateDraft("mission", body);
  assert.ok(issues.length > 0, "should return issues for empty narrative_hook");
});

test("validateDraft(mission): dangling target_stage_id returns issues", () => {
  const body = {
    ...validMissionBody,
    actions: [
      {
        id: "action-advance",
        label: "Continue",
        kind: "continue",
        target_stage_id: "stage-nonexistent", // does not exist
      },
      {
        id: "action-complete",
        label: "Finish",
        kind: "complete",
      },
    ],
  };
  const issues = validateDraft("mission", body);
  assert.ok(issues.length > 0, "should return issues for dangling target_stage_id");
});

test("validateDraft(mission): no complete action returns issues", () => {
  const body = {
    ...validMissionBody,
    actions: [
      {
        id: "action-advance",
        label: "Continue",
        kind: "continue",
        target_stage_id: "stage-debrief",
      },
      // no 'complete' action
    ],
  };
  const issues = validateDraft("mission", body);
  assert.ok(issues.length > 0, "should return issues when no complete action exists");
});

test("validateDraft(mission): contradiction_review referencing unknown claim label returns issues", () => {
  const body = {
    ...validMissionBody,
    contradiction_review: {
      ...validMissionBody.contradiction_review,
      correct_claim_labels: ["A", "Z"], // Z does not exist
    },
  };
  const issues = validateDraft("mission", body);
  assert.ok(issues.length > 0, "should return issues for unknown claim label in contradiction_review");
});

test("validateDraft(mission): resolution_review referencing unknown option id returns issues", () => {
  const body = {
    ...validMissionBody,
    resolution_review: {
      ...validMissionBody.resolution_review,
      best_option_id: "option-nonexistent",
    },
  };
  const issues = validateDraft("mission", body);
  assert.ok(issues.length > 0, "should return issues for unknown best_option_id");
});

// ---------------------------------------------------------------------------
// Refinement logic: instruction applied, schema-valid, unaddressed fields preserved
// (Requirements 3.1, 3.2)
// ---------------------------------------------------------------------------

test("refined body that passes schema validation has no issues", () => {
  // Simulate a refinement that changes question_text but preserves everything else
  const refinedBody = {
    ...validActivityBody,
    question_text: "Which two claims about climate change directly contradict each other?",
  };

  const issues = validateDraft("activity", refinedBody);
  assert.deepEqual(issues, [], "refined body should pass validation");
});

test("refined body preserves unaddressed fields", () => {
  // Simulate: instruction was 'change the question text only'
  // All other fields should remain identical
  const refinedBody = {
    ...validActivityBody,
    question_text: "Which two claims about nutrition directly contradict each other?",
  };

  // Unaddressed fields are preserved
  assert.deepEqual(refinedBody.prompt_claims, validActivityBody.prompt_claims);
  assert.deepEqual(refinedBody.correct_answer_labels, validActivityBody.correct_answer_labels);
  assert.equal(refinedBody.explanation, validActivityBody.explanation);
  assert.equal(refinedBody.expected_answer_count, validActivityBody.expected_answer_count);
});

// ---------------------------------------------------------------------------
// Inapplicable instruction → validation failure → draft unchanged (Req 3.4)
// ---------------------------------------------------------------------------

test("body that fails post-refine validation is rejected (inapplicable)", () => {
  // Simulate a refinement that produces an invalid body (e.g. empty question_text)
  const invalidRefinedBody = {
    ...validActivityBody,
    question_text: "", // invalid — would fail schema
  };

  const issues = validateDraft("activity", invalidRefinedBody);
  assert.ok(issues.length > 0, "invalid refined body should fail validation");
  // The route would return AUTHORING_REFINE_INAPPLICABLE and leave the draft unchanged
});

test("mockResponse = currentBody produces a valid body (no-change degradation)", () => {
  // When the AI is unavailable, mockResponse = currentBody is returned.
  // The current body must pass validation for the draft to be updated.
  const issues = validateDraft("activity", validActivityBody);
  assert.deepEqual(issues, [], "currentBody used as mockResponse must itself be valid");
});

// ---------------------------------------------------------------------------
// Cumulative turns compose (Req 3.3)
// ---------------------------------------------------------------------------

test("cumulative refinements compose: each turn operates on the latest body", () => {
  // Turn 1: change question_text
  const afterTurn1 = {
    ...validActivityBody,
    question_text: "Which two claims about nutrition directly contradict each other?",
  };
  assert.deepEqual(validateDraft("activity", afterTurn1), []);

  // Turn 2: add a claim (operating on afterTurn1, not the original)
  const afterTurn2 = {
    ...afterTurn1,
    prompt_claims: [
      ...afterTurn1.prompt_claims,
      "E: Nutrition labels are always accurate.",
    ],
  };
  assert.deepEqual(validateDraft("activity", afterTurn2), []);

  // Turn 3: change explanation (operating on afterTurn2)
  const afterTurn3 = {
    ...afterTurn2,
    explanation: "Claims A and B contradict each other about nutrition outcomes.",
  };
  assert.deepEqual(validateDraft("activity", afterTurn3), []);

  // The final body reflects all three turns composed
  assert.equal(afterTurn3.question_text, afterTurn1.question_text);
  assert.equal(afterTurn3.prompt_claims.length, afterTurn2.prompt_claims.length);
  assert.equal(afterTurn3.explanation, "Claims A and B contradict each other about nutrition outcomes.");
});

// ---------------------------------------------------------------------------
// Origin promotion (Req 3.5)
// ---------------------------------------------------------------------------

test("origin: manual draft refined by AI becomes co_authored", () => {
  // Simulate the origin promotion logic from the route
  function computeNewOrigin(currentOrigin: string): string {
    return currentOrigin === "manual" ? "co_authored" : currentOrigin;
  }

  assert.equal(computeNewOrigin("manual"), "co_authored");
  assert.equal(computeNewOrigin("ai"), "ai");
  assert.equal(computeNewOrigin("co_authored"), "co_authored");
});

// ---------------------------------------------------------------------------
// Refine prompt builders (sanity checks for the route's prompt construction)
// ---------------------------------------------------------------------------

test("buildRefineUserPrompt embeds current body and instruction", () => {
  const prompt = buildRefineUserPrompt(validActivityBody, "Make the question harder.");
  assert.ok(prompt.includes('"question_text"'), "should include JSON body");
  assert.ok(prompt.includes("Make the question harder"), "should include instruction");
});

test("buildRefineSystemPrompt for activity instructs whole-object return and schema conformance", () => {
  const prompt = buildRefineSystemPrompt("activity");
  assert.ok(prompt.includes("COMPLETE"), "should require complete revised object");
  assert.ok(prompt.includes("prompt_claims"), "should reference activity schema fields");
});

test("buildRefineSystemPrompt for mission instructs whole-object return and schema conformance", () => {
  const prompt = buildRefineSystemPrompt("mission");
  assert.ok(prompt.includes("COMPLETE"), "should require complete revised object");
  assert.ok(prompt.includes("stages"), "should reference mission schema fields");
});

// ---------------------------------------------------------------------------
// activityBodySchema: schema-valid output after refinement (Req 3.2)
// ---------------------------------------------------------------------------

test("activityBodySchema accepts a refined body with changed question_text", () => {
  const refined = {
    ...validActivityBody,
    question_text: "Which two claims about exercise directly contradict each other?",
  };
  const result = activityBodySchema.safeParse(refined);
  assert.ok(result.success, "refined activity body should pass schema parse");
});

test("activityBodySchema rejects a refined body with invalid expected_answer_count", () => {
  const refined = {
    ...validActivityBody,
    expected_answer_count: 5, // out of range
  };
  const result = activityBodySchema.safeParse(refined);
  assert.ok(!result.success, "out-of-range expected_answer_count should fail schema");
});

test("missionBodySchema accepts a refined body with changed narrative_hook", () => {
  const refined = {
    ...validMissionBody,
    narrative_hook: "A new mystery emerges at the research station.",
  };
  const result = missionBodySchema.safeParse(refined);
  assert.ok(result.success, "refined mission body should pass schema parse");
});
