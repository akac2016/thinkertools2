import assert from "node:assert/strict";
import test from "node:test";

import {
  extractCorrectAnswerLabels,
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
