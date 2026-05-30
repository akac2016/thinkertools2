import assert from "node:assert/strict";
import test from "node:test";

import {
  matchConstrainedTypedInput,
  normalizeConstrainedTypedInput,
} from "../lib/quests/constrained-matcher.ts";

test("normalizes casing, spacing, ampersands, and commas", () => {
  assert.equal(normalizeConstrainedTypedInput("  Claims A & C  "), "claims a and c");
  assert.equal(normalizeConstrainedTypedInput("A,C"), "a and c");
});

test("matches canonical pair responses across formatting variants", () => {
  const config = {
    visibleOptionLabels: ["A", "B", "C", "D"],
    expectedSelectionCount: 2,
  };

  const variants = ["A and C", "A,C", "claims A and C", "  a   &   c "];

  for (const variant of variants) {
    const result = matchConstrainedTypedInput(variant, config);
    assert.equal(result.status, "matched");
    if (result.status === "matched") {
      assert.deepEqual(result.selectedLabels, ["A", "C"]);
      assert.equal(result.canonicalAnswer, "A and C");
    }
  }
});

test("matches numeric label responses", () => {
  const result = matchConstrainedTypedInput("claims 1 and 3", {
    visibleOptionLabels: ["1", "2", "3", "4"],
    expectedSelectionCount: 2,
  });

  assert.equal(result.status, "matched");
  if (result.status === "matched") {
    assert.deepEqual(result.selectedLabels, ["1", "3"]);
  }
});

test("returns recoverable invalid state for unrecognized free text", () => {
  const result = matchConstrainedTypedInput("I think A is right because...", {
    visibleOptionLabels: ["A", "B", "C"],
    expectedSelectionCount: 1,
  });

  assert.equal(result.status, "invalid_input");
  if (result.status === "invalid_input") {
    assert.equal(result.reason, "unrecognized_input");
    assert.equal(result.recoverableMessage, "Please choose or type one of the listed options.");
  }
});

test("returns recoverable invalid state for wrong count or duplicates", () => {
  const wrongCount = matchConstrainedTypedInput("A", {
    visibleOptionLabels: ["A", "B", "C"],
    expectedSelectionCount: 2,
  });

  assert.equal(wrongCount.status, "invalid_input");
  if (wrongCount.status === "invalid_input") {
    assert.equal(wrongCount.reason, "wrong_selection_count");
  }

  const duplicate = matchConstrainedTypedInput("A and A", {
    visibleOptionLabels: ["A", "B", "C"],
    expectedSelectionCount: 2,
  });

  assert.equal(duplicate.status, "invalid_input");
  if (duplicate.status === "invalid_input") {
    assert.equal(duplicate.reason, "duplicate_selection");
  }
});
