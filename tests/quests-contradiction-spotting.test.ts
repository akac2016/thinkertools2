import assert from "node:assert/strict";
import test from "node:test";

import {
  extractCorrectAnswerLabels,
  extractExpectedAnswerCount,
  extractPromptClaims,
  isMatchingLabelPair,
  normalizeLabelSelection,
} from "../lib/quests/contradiction-spotting.ts";

test("extractPromptClaims parses labeled text and preserves display format", () => {
  const claims = extractPromptClaims({
    prompt_claims: [
      "A. People should always tell the truth.",
      "B. Sometimes lying is morally necessary.",
      "C. Honesty helps social trust.",
      "D. Trust matters in human communities.",
    ],
  });

  assert.deepEqual(claims.map((claim) => claim.label), ["A", "B", "C", "D"]);
  assert.equal(claims[0].displayText, "A. People should always tell the truth.");
});

test("normalizeLabelSelection uppercases, deduplicates, and strips punctuation", () => {
  const labels = normalizeLabelSelection([" a ", "B", "A", "c,", "", " "]);
  assert.deepEqual(labels, ["A", "B", "C"]);
});

test("extractCorrectAnswerLabels uses normalized labels", () => {
  const labels = extractCorrectAnswerLabels({
    correct_answer_labels: ["a", " c "],
  });

  assert.deepEqual(labels, ["A", "C"]);
});

test("isMatchingLabelPair compares pair selections order-independently", () => {
  assert.equal(isMatchingLabelPair(["A", "C"], ["C", "A"]), true);
  assert.equal(isMatchingLabelPair(["A", "B"], ["A", "C"]), false);
});

// extractExpectedAnswerCount

test("extractExpectedAnswerCount returns 2 when field is absent", () => {
  assert.equal(extractExpectedAnswerCount({}), 2);
});

test("extractExpectedAnswerCount returns 1 when explicitly set to 1", () => {
  assert.equal(extractExpectedAnswerCount({ expected_answer_count: 1 }), 1);
});

test("extractExpectedAnswerCount returns 2 when explicitly set to 2", () => {
  assert.equal(extractExpectedAnswerCount({ expected_answer_count: 2 }), 2);
});

test("extractExpectedAnswerCount returns 2 for out-of-range values", () => {
  assert.equal(extractExpectedAnswerCount({ expected_answer_count: 0 }), 2);
  assert.equal(extractExpectedAnswerCount({ expected_answer_count: 3 }), 2);
  assert.equal(extractExpectedAnswerCount({ expected_answer_count: -1 }), 2);
  assert.equal(extractExpectedAnswerCount({ expected_answer_count: "2" }), 2);
});

// isMatchingLabelPair — 1- and 2-element answers

test("isMatchingLabelPair grades a single correct answer", () => {
  assert.equal(isMatchingLabelPair(["A"], ["A"]), true);
  assert.equal(isMatchingLabelPair(["B"], ["A"]), false);
});

test("isMatchingLabelPair rejects mismatched lengths", () => {
  assert.equal(isMatchingLabelPair(["A"], ["A", "B"]), false);
  assert.equal(isMatchingLabelPair(["A", "B"], ["A"]), false);
});

// Submit route cardinality behaviour — tested via the helpers that drive the route

test("1-answer round: correct single selection is accepted by isMatchingLabelPair", () => {
  // Simulates a round with expected_answer_count: 1
  const correctAnswerLabels = extractCorrectAnswerLabels({ correct_answer_labels: ["B"] });
  const expectedCount = extractExpectedAnswerCount({ expected_answer_count: 1 });

  assert.equal(expectedCount, 1);
  assert.equal(correctAnswerLabels.length, expectedCount); // config guard passes
  assert.equal(isMatchingLabelPair(["B"], correctAnswerLabels), true);
});

test("1-answer round: wrong single selection is rejected by isMatchingLabelPair", () => {
  const correctAnswerLabels = extractCorrectAnswerLabels({ correct_answer_labels: ["B"] });
  assert.equal(isMatchingLabelPair(["A"], correctAnswerLabels), false);
});

test("1-answer round: 2-label submission fails the wrong_selection_count check", () => {
  // The route rejects selectedLabels.length !== expectedCount before resolving
  const expectedCount = extractExpectedAnswerCount({ expected_answer_count: 1 });
  const submittedLabels = ["A", "B"];

  assert.equal(submittedLabels.length !== expectedCount, true); // triggers MISSIONS_SELECTION_REQUIRED
});

test("1-answer round: config guard rejects a round with 2 correct labels declared for count=1", () => {
  const correctAnswerLabels = extractCorrectAnswerLabels({ correct_answer_labels: ["A", "B"] });
  const expectedCount = extractExpectedAnswerCount({ expected_answer_count: 1 });

  // correctAnswerLabels.length !== expectedCount → misconfigured
  assert.equal(correctAnswerLabels.length !== expectedCount, true);
});

test("2-answer round: existing behaviour unchanged — correct pair accepted", () => {
  // Round with no expected_answer_count field (legacy row) defaults to 2
  const correctAnswerLabels = extractCorrectAnswerLabels({ correct_answer_labels: ["A", "C"] });
  const expectedCount = extractExpectedAnswerCount({}); // absent → 2

  assert.equal(expectedCount, 2);
  assert.equal(correctAnswerLabels.length, expectedCount); // config guard passes
  assert.equal(isMatchingLabelPair(["C", "A"], correctAnswerLabels), true);
});

test("2-answer round: existing behaviour unchanged — wrong pair rejected", () => {
  const correctAnswerLabels = extractCorrectAnswerLabels({ correct_answer_labels: ["A", "C"] });
  assert.equal(isMatchingLabelPair(["A", "B"], correctAnswerLabels), false);
});

test("2-answer round: single-label submission fails the wrong_selection_count check", () => {
  const expectedCount = extractExpectedAnswerCount({}); // 2
  const submittedLabels = ["A"];

  assert.equal(submittedLabels.length !== expectedCount, true); // triggers MISSIONS_SELECTION_REQUIRED
});
