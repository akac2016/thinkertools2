import assert from "node:assert/strict";
import test from "node:test";

import { validateDraft } from "../lib/authoring/validation.ts";

// ---------------------------------------------------------------------------
// Helpers — minimal valid fixtures
// ---------------------------------------------------------------------------

function validActivityBody() {
  return {
    round_type: "activity_standard",
    question_text: "Which two claims are in strongest contradiction?",
    prompt_claims: [
      "A. The sky is blue.",
      "B. The sky is green.",
      "C. Water is wet.",
      "D. Water is dry.",
    ],
    correct_answer_labels: ["A", "B"],
    explanation: "A and B directly contradict each other.",
    expected_answer_count: 2,
  };
}

function validMissionBody() {
  return {
    narrative_hook: "A mystery unfolds.",
    short_description: "Investigate the case.",
    difficulty_label: "medium",
    required_training_level: 3,
    xp_reward: 100,
    stages: [
      {
        id: "stage-1",
        title: "Introduction",
        objective: "Learn the basics.",
        guide_messages: ["Welcome to the mission."],
        action_ids: ["action-1"],
        revealed_fact_ids: [],
      },
      {
        id: "stage-2",
        title: "Contradiction",
        objective: "Spot the contradiction.",
        guide_messages: ["Review the claims."],
        action_ids: ["action-2"],
        revealed_fact_ids: [],
      },
      {
        id: "stage-3",
        title: "Resolution",
        objective: "Choose the best option.",
        guide_messages: ["Pick wisely."],
        action_ids: ["action-3"],
        revealed_fact_ids: [],
      },
      {
        id: "stage-debrief",
        title: "Debrief",
        objective: "Reflect on the mission.",
        guide_messages: ["Well done."],
        action_ids: ["action-complete"],
        revealed_fact_ids: [],
      },
    ],
    actions: [
      { id: "action-1", label: "Continue", kind: "continue", target_stage_id: "stage-2" },
      { id: "action-2", label: "Spot it", kind: "select-contradiction", target_stage_id: "stage-3" },
      { id: "action-3", label: "Resolve", kind: "select-resolution", target_stage_id: "stage-debrief" },
      { id: "action-complete", label: "Finish", kind: "complete" },
    ],
    facts: [],
    character_claims: [
      {
        id: "claim-1",
        label: "A",
        character_name: "Alice",
        role: "Witness",
        statement: "I was there.",
        revealed_fact_ids: [],
      },
      {
        id: "claim-2",
        label: "B",
        character_name: "Bob",
        role: "Suspect",
        statement: "I was not there.",
        revealed_fact_ids: [],
      },
    ],
    contradiction_review: {
      stage_id: "stage-2",
      prompt: "Which claims contradict?",
      claim_ids: ["claim-1", "claim-2"],
      correct_claim_labels: ["A", "B"],
      correct_claim_ids: ["claim-1", "claim-2"],
      explanation: "A and B directly contradict.",
    },
    resolution_options: [
      { id: "opt-1", label: "Option 1", body: "First option.", feedback: "Good choice." },
      { id: "opt-2", label: "Option 2", body: "Second option.", feedback: "Not ideal." },
    ],
    resolution_review: {
      stage_id: "stage-3",
      prompt: "Which option is best?",
      option_ids: ["opt-1", "opt-2"],
      best_option_id: "opt-1",
      explanation: "Option 1 is best.",
    },
    debrief: {
      completion_message: "Mission complete!",
      takeaway: "Always verify your sources.",
      handoff_message: "Return to training.",
    },
  };
}

// ---------------------------------------------------------------------------
// Activity — valid body
// ---------------------------------------------------------------------------

test("validateDraft(activity) returns no issues for a valid body", () => {
  const issues = validateDraft("activity", validActivityBody());
  assert.deepEqual(issues, []);
});

// ---------------------------------------------------------------------------
// Activity — label-resolution failures
// ---------------------------------------------------------------------------

test("validateDraft(activity) reports error when correct_answer_label does not resolve to a claim", () => {
  const body = {
    ...validActivityBody(),
    correct_answer_labels: ["Z"], // 'Z' is not a label in the prompt_claims
    expected_answer_count: 1,
  };
  const issues = validateDraft("activity", body);
  const paths = issues.map((i) => i.path);
  assert.ok(
    paths.includes("correct_answer_labels"),
    `expected correct_answer_labels issue, got: ${JSON.stringify(issues)}`
  );
  const issue = issues.find((i) => i.path === "correct_answer_labels" && i.code === "unresolved_claim_label");
  assert.ok(issue, "should have an unresolved_claim_label issue");
  assert.ok(issue!.message.includes("Z"), "message should mention the missing label");
});

test("validateDraft(activity) reports error for multiple unresolved correct labels", () => {
  const body = {
    ...validActivityBody(),
    correct_answer_labels: ["X", "Y"],
    expected_answer_count: 2,
  };
  const issues = validateDraft("activity", body);
  const unresolved = issues.filter((i) => i.code === "unresolved_claim_label");
  assert.ok(unresolved.length > 0, "should report unresolved label issues");
});

test("validateDraft(activity) reports error for duplicate claim labels", () => {
  const body = {
    ...validActivityBody(),
    // Both claims parse to label 'A'
    prompt_claims: ["A. First claim.", "A. Duplicate label claim.", "B. Third.", "C. Fourth."],
    correct_answer_labels: ["B", "C"],
    expected_answer_count: 2,
  };
  const issues = validateDraft("activity", body);
  const dupIssue = issues.find((i) => i.code === "duplicate_claim_labels");
  assert.ok(dupIssue, "should report duplicate_claim_labels issue");
  assert.ok(dupIssue!.message.includes("A"), "message should mention the duplicate label");
});

test("validateDraft(activity) reports zod error for missing required field", () => {
  const body: Partial<ReturnType<typeof validActivityBody>> = validActivityBody();
  delete body.question_text;
  const issues = validateDraft("activity", body);
  assert.ok(issues.length > 0, "should report zod validation issues");
});

test("validateDraft(activity) reports error when correct_answer_labels count mismatches expected_answer_count", () => {
  const body = {
    ...validActivityBody(),
    correct_answer_labels: ["A"], // only 1 but expected_answer_count is 2
    expected_answer_count: 2,
  };
  const issues = validateDraft("activity", body);
  assert.ok(issues.length > 0, "should report mismatch issue");
});

// ---------------------------------------------------------------------------
// Mission — valid body
// ---------------------------------------------------------------------------

test("validateDraft(mission) returns no issues for a valid body", () => {
  const issues = validateDraft("mission", validMissionBody());
  assert.deepEqual(issues, []);
});

// ---------------------------------------------------------------------------
// Mission — unreachable debrief
// ---------------------------------------------------------------------------

test("validateDraft(mission) reports unreachable_debrief when no path leads to a complete action", () => {
  const body = validMissionBody();
  // Break the chain: action-3 no longer points to stage-debrief
  body.actions = body.actions.map((a) =>
    a.id === "action-3" ? { ...a, target_stage_id: "stage-2" } : a
  );
  const issues = validateDraft("mission", body);
  const issue = issues.find((i) => i.code === "unreachable_debrief");
  assert.ok(issue, `expected unreachable_debrief issue, got: ${JSON.stringify(issues)}`);
});

test("validateDraft(mission) reports no_complete_action when no action has kind complete", () => {
  const body = validMissionBody();
  body.actions = body.actions.map((a) =>
    a.kind === "complete" ? { ...a, kind: "continue" as const } : a
  );
  const issues = validateDraft("mission", body);
  const issue = issues.find((i) => i.code === "no_complete_action");
  assert.ok(issue, `expected no_complete_action issue, got: ${JSON.stringify(issues)}`);
});

// ---------------------------------------------------------------------------
// Mission — dangling targetStageId
// ---------------------------------------------------------------------------

test("validateDraft(mission) reports dangling_target_stage_id for a non-existent target", () => {
  const body = validMissionBody();
  body.actions = body.actions.map((a) =>
    a.id === "action-1" ? { ...a, target_stage_id: "stage-does-not-exist" } : a
  );
  const issues = validateDraft("mission", body);
  const issue = issues.find((i) => i.code === "dangling_target_stage_id");
  assert.ok(issue, `expected dangling_target_stage_id issue, got: ${JSON.stringify(issues)}`);
  assert.ok(
    issue!.message.includes("stage-does-not-exist"),
    "message should mention the missing stage id"
  );
});

// ---------------------------------------------------------------------------
// Mission — review references missing claim / option
// ---------------------------------------------------------------------------

test("validateDraft(mission) reports missing_claim_label when contradiction_review references a non-existent label", () => {
  const body = validMissionBody();
  body.contradiction_review = {
    ...body.contradiction_review,
    correct_claim_labels: ["A", "NONEXISTENT"],
  };
  const issues = validateDraft("mission", body);
  const issue = issues.find((i) => i.code === "missing_claim_label");
  assert.ok(issue, `expected missing_claim_label issue, got: ${JSON.stringify(issues)}`);
  assert.ok(issue!.message.includes("NONEXISTENT"), "message should mention the missing label");
});

test("validateDraft(mission) reports missing_resolution_option when resolution_review references a non-existent option id", () => {
  const body = validMissionBody();
  body.resolution_review = {
    ...body.resolution_review,
    best_option_id: "opt-does-not-exist",
  };
  const issues = validateDraft("mission", body);
  const issue = issues.find((i) => i.code === "missing_resolution_option");
  assert.ok(issue, `expected missing_resolution_option issue, got: ${JSON.stringify(issues)}`);
  assert.ok(
    issue!.message.includes("opt-does-not-exist"),
    "message should mention the missing option id"
  );
});

test("validateDraft(mission) reports zod error for missing required field", () => {
  const body: Partial<ReturnType<typeof validMissionBody>> = validMissionBody();
  delete body.narrative_hook;
  const issues = validateDraft("mission", body);
  assert.ok(issues.length > 0, "should report zod validation issues");
});
