import {
  MISSIONS_MAX_LEVEL,
  type CompletionContentType,
  type TrainingProgress,
} from "./domain-types.ts";

export const LEVEL_CAP = MISSIONS_MAX_LEVEL;

export const XP_REQUIRED_BY_LEVEL: Readonly<Record<number, number>> = {
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
} as const;

export const OVERLEVEL_HALF_XP_LEVELS = 2 as const;

export type ProgressionRewardInput = {
  contentType: CompletionContentType;
  baseXp: number;
  userLevel: number;
  recommendedLevelMin: number;
  recommendedLevelMax: number;
};

export type ProgressionRewardResult = {
  awardedXp: number;
  multiplier: 1 | 0.5 | 0;
};

export function getXpRequiredForNextLevel(level: number): number {
  assertLevelInRange(level);
  if (level >= LEVEL_CAP) {
    return 0;
  }

  return XP_REQUIRED_BY_LEVEL[level];
}

export function getTotalXpRequiredToReachLevel(level: number): number {
  assertLevelInRange(level);
  let total = 0;

  for (let current = 1; current < level; current += 1) {
    total += getXpRequiredForNextLevel(current);
  }

  return total;
}

export function computeOverlevelXpMultiplier(
  userLevel: number,
  recommendedLevelMax: number,
): 1 | 0.5 | 0 {
  assertLevelInRange(userLevel);
  assertLevelInRange(recommendedLevelMax);

  if (userLevel <= recommendedLevelMax) {
    return 1;
  }

  if (userLevel <= recommendedLevelMax + OVERLEVEL_HALF_XP_LEVELS) {
    return 0.5;
  }

  return 0;
}

export function computeCompletionRewardXp(input: ProgressionRewardInput): ProgressionRewardResult {
  assertNonNegativeXp(input.baseXp);
  if (input.contentType === "mission") {
    return {
      awardedXp: input.baseXp,
      multiplier: 1,
    };
  }

  assertLevelBand(input.recommendedLevelMin, input.recommendedLevelMax);
  assertLevelInRange(input.userLevel);

  const multiplier = computeOverlevelXpMultiplier(input.userLevel, input.recommendedLevelMax);
  return {
    awardedXp: Math.floor(input.baseXp * multiplier),
    multiplier,
  };
}

export function applyEarnedXp(
  progress: TrainingProgress,
  earnedXp: number,
): TrainingProgress {
  assertNonNegativeXp(earnedXp);
  assertLevelInRange(progress.currentLevel);
  assertNonNegativeXp(progress.currentLevelXp);
  assertNonNegativeXp(progress.totalXp);

  let currentLevel = progress.currentLevel;
  let currentLevelXp = progress.currentLevelXp;
  const totalXp = progress.totalXp + earnedXp;

  if (currentLevel >= LEVEL_CAP) {
    return {
      currentLevel: LEVEL_CAP,
      currentLevelXp: 0,
      totalXp,
    };
  }

  let remainingXp = earnedXp;

  while (remainingXp > 0 && currentLevel < LEVEL_CAP) {
    const xpNeeded = getXpRequiredForNextLevel(currentLevel);
    const levelGap = Math.max(0, xpNeeded - currentLevelXp);

    if (remainingXp < levelGap) {
      currentLevelXp += remainingXp;
      remainingXp = 0;
      break;
    }

    remainingXp -= levelGap;
    currentLevel += 1;
    currentLevelXp = 0;
  }

  if (currentLevel >= LEVEL_CAP) {
    currentLevel = LEVEL_CAP;
    currentLevelXp = 0;
  }

  return {
    currentLevel,
    currentLevelXp,
    totalXp,
  };
}

function assertLevelInRange(level: number): void {
  if (!Number.isInteger(level) || level < 1 || level > LEVEL_CAP) {
    throw new RangeError(`Level must be an integer between 1 and ${LEVEL_CAP}. Received: ${level}`);
  }
}

function assertNonNegativeXp(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`XP value must be >= 0. Received: ${value}`);
  }
}

function assertLevelBand(minLevel: number, maxLevel: number): void {
  assertLevelInRange(minLevel);
  assertLevelInRange(maxLevel);

  if (minLevel > maxLevel) {
    throw new RangeError(
      `Recommended level band must have min <= max. Received min=${minLevel}, max=${maxLevel}`,
    );
  }
}
