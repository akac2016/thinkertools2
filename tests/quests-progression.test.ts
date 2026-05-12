import assert from "node:assert/strict";
import test from "node:test";

import {
  TRAINING_ACTIVITY_CONTENT_TYPE,
  XP_REQUIRED_BY_LEVEL,
  applyEarnedXp,
  computeCompletionRewardXp,
  getXpRequiredForNextLevel,
} from "../lib/quests/index.ts";

test("XP table matches locked values", () => {
  assert.deepEqual(XP_REQUIRED_BY_LEVEL, {
    1: 20,
    2: 30,
    3: 40,
    4: 55,
    5: 70,
    6: 85,
    7: 100,
    8: 120,
    9: 140,
    10: 165,
    11: 190,
    12: 220,
    13: 250,
    14: 285,
    15: 320,
    16: 360,
    17: 400,
    18: 450,
    19: 500,
  });
  assert.equal(getXpRequiredForNextLevel(1), 20);
  assert.equal(getXpRequiredForNextLevel(19), 500);
  assert.equal(getXpRequiredForNextLevel(20), 0);
});

test("practice completion gives full, then 50%, then zero XP when overleveled", () => {
  assert.deepEqual(
    computeCompletionRewardXp({
      contentType: TRAINING_ACTIVITY_CONTENT_TYPE,
      baseXp: 10,
      userLevel: 3,
      recommendedLevelMin: 1,
      recommendedLevelMax: 3,
    }),
    { awardedXp: 10, multiplier: 1 },
  );

  assert.deepEqual(
    computeCompletionRewardXp({
      contentType: TRAINING_ACTIVITY_CONTENT_TYPE,
      baseXp: 10,
      userLevel: 4,
      recommendedLevelMin: 1,
      recommendedLevelMax: 3,
    }),
    { awardedXp: 5, multiplier: 0.5 },
  );

  assert.deepEqual(
    computeCompletionRewardXp({
      contentType: TRAINING_ACTIVITY_CONTENT_TYPE,
      baseXp: 10,
      userLevel: 5,
      recommendedLevelMin: 1,
      recommendedLevelMax: 3,
    }),
    { awardedXp: 5, multiplier: 0.5 },
  );

  assert.deepEqual(
    computeCompletionRewardXp({
      contentType: TRAINING_ACTIVITY_CONTENT_TYPE,
      baseXp: 10,
      userLevel: 6,
      recommendedLevelMin: 1,
      recommendedLevelMax: 3,
    }),
    { awardedXp: 0, multiplier: 0 },
  );
});

test("quest completion awards full configured XP", () => {
  assert.deepEqual(
    computeCompletionRewardXp({
      contentType: "quest",
      baseXp: 80,
      userLevel: 15,
      recommendedLevelMin: 1,
      recommendedLevelMax: 3,
    }),
    { awardedXp: 80, multiplier: 1 },
  );
});

test("applyEarnedXp levels up repeatedly and honors level cap", () => {
  const leveled = applyEarnedXp(
    {
      currentLevel: 1,
      currentLevelXp: 0,
      totalXp: 0,
    },
    55,
  );

  assert.deepEqual(leveled, {
    currentLevel: 3,
    currentLevelXp: 5,
    totalXp: 55,
  });

  const capped = applyEarnedXp(
    {
      currentLevel: 20,
      currentLevelXp: 12,
      totalXp: 999,
    },
    10,
  );

  assert.deepEqual(capped, {
    currentLevel: 20,
    currentLevelXp: 0,
    totalXp: 1009,
  });
});
