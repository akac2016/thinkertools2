import type { TrainingActivityRoundContent } from "./domain-types.ts";

const DEFAULT_QUESTION_TEXT = "Which two claims are in strongest contradiction?";
const DEFAULT_EXPLANATION = "Review the claims and compare the strongest conflict.";

export type ContradictionPromptClaim = {
  label: string;
  text: string;
  displayText: string;
};

export function extractPromptClaims(roundContent: TrainingActivityRoundContent): ContradictionPromptClaim[] {
  const rawClaims = Array.isArray(roundContent.prompt_claims)
    ? roundContent.prompt_claims
    : [];

  const parsedClaims: ContradictionPromptClaim[] = [];
  const seenLabels = new Set<string>();

  rawClaims.forEach((rawValue, index) => {
    const parsed = parsePromptClaim(rawValue, index);
    if (!parsed) {
      return;
    }

    if (seenLabels.has(parsed.label)) {
      return;
    }

    seenLabels.add(parsed.label);
    parsedClaims.push(parsed);
  });

  return parsedClaims;
}

export function extractQuestionText(roundContent: TrainingActivityRoundContent): string {
  const question = typeof roundContent.question_text === "string"
    ? roundContent.question_text.trim()
    : "";

  return question || DEFAULT_QUESTION_TEXT;
}

export function extractExplanation(roundContent: TrainingActivityRoundContent): string {
  const explanation = typeof roundContent.explanation === "string"
    ? roundContent.explanation.trim()
    : "";

  return explanation || DEFAULT_EXPLANATION;
}

export function extractRoundTypeTag(roundContent: TrainingActivityRoundContent): string {
  const roundType = typeof roundContent.round_type === "string"
    ? roundContent.round_type.trim()
    : "";

  return roundType || "activity_standard";
}

export function extractCorrectAnswerLabels(roundContent: TrainingActivityRoundContent): string[] {
  const rawLabels = Array.isArray(roundContent.correct_answer_labels)
    ? roundContent.correct_answer_labels
    : [];

  return normalizeLabelSelection(rawLabels);
}

export function normalizeLabelSelection(labels: unknown[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const label of labels) {
    if (typeof label !== "string") {
      continue;
    }

    const token = normalizeLabelToken(label);
    if (!token || seen.has(token)) {
      continue;
    }

    seen.add(token);
    normalized.push(token);
  }

  return normalized;
}

export function extractExpectedAnswerCount(roundContent: TrainingActivityRoundContent): 1 | 2 {
  const n = roundContent.expected_answer_count;
  if (n === 1 || n === 2) {
    return n;
  }
  return 2;
}

export function isMatchingLabelPair(selectedLabels: string[], expectedLabels: string[]): boolean {
  if (selectedLabels.length !== expectedLabels.length) {
    return false;
  }

  const selectedSorted = [...selectedLabels].sort();
  const expectedSorted = [...expectedLabels].sort();

  return selectedSorted.every((value, index) => value === expectedSorted[index]);
}

export function parsePromptClaim(rawValue: unknown, index: number): ContradictionPromptClaim | null {
  if (typeof rawValue !== "string") {
    return null;
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return null;
  }

  const matched = trimmed.match(/^([A-Za-z0-9]+)\s*[.):-]\s*(.+)$/);
  const fallbackLabel = getFallbackLabel(index);
  const label = matched ? normalizeLabelToken(matched[1]) : fallbackLabel;
  const text = matched ? matched[2].trim() : trimmed;

  if (!label || !text) {
    return null;
  }

  return {
    label,
    text,
    displayText: `${label}. ${text}`,
  };
}

function getFallbackLabel(index: number): string {
  if (index >= 0 && index <= 25) {
    return String.fromCharCode(65 + index);
  }

  return String(index + 1);
}

function normalizeLabelToken(rawLabel: string): string {
  const matched = rawLabel.trim().toUpperCase().match(/[A-Z0-9]+/);
  return matched ? matched[0] : "";
}
