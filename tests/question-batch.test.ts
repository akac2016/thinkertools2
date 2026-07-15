import assert from "node:assert/strict";
import test from "node:test";

import { extractPastedQuestionBatch } from "../lib/authoring/question-batch.ts";

test("extracts multiple question-mark prompts from one paste", () => {
  assert.deepEqual(
    extractPastedQuestionBatch("What is mitosis? Why does it matter?"),
    ["What is mitosis?", "Why does it matter?"],
  );
});

test("extracts numbered prompts without question marks", () => {
  assert.deepEqual(
    extractPastedQuestionBatch("1. Explain photosynthesis\n2. Compare respiration and fermentation"),
    ["Explain photosynthesis", "Compare respiration and fermentation"],
  );
});

test("does not treat one question or ordinary prose as a batch", () => {
  assert.equal(extractPastedQuestionBatch("What is mitosis?"), null);
  assert.equal(
    extractPastedQuestionBatch("Create a practice activity about cells and energy."),
    null,
  );
});

