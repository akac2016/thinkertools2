export const RECOVERABLE_INVALID_INPUT_MESSAGE =
  "Please choose or type one of the listed options.";

const WRAPPER_TOKENS = new Set([
  "answer",
  "answers",
  "choice",
  "choices",
  "claim",
  "claims",
  "option",
  "options",
  "pair",
  "pairs",
  "select",
  "selected",
]);

export type ConstrainedMatcherConfig = {
  visibleOptionLabels: string[];
  expectedSelectionCount?: number;
};

export type ConstrainedMatcherMatchResult = {
  status: "matched";
  selectedLabels: string[];
  canonicalAnswer: string;
  normalizedInput: string;
};

export type ConstrainedMatcherInvalidResult = {
  status: "invalid_input";
  reason: "empty_input" | "unrecognized_input" | "duplicate_selection" | "wrong_selection_count";
  normalizedInput: string;
  recoverableMessage: typeof RECOVERABLE_INVALID_INPUT_MESSAGE;
};

export type ConstrainedMatcherResult =
  | ConstrainedMatcherMatchResult
  | ConstrainedMatcherInvalidResult;

export function normalizeConstrainedTypedInput(input: string): string {
  if (typeof input !== "string") {
    return "";
  }

  return input
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/,/g, " and ")
    .replace(/[()\[\]{}:;.!?]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchConstrainedTypedInput(
  input: string,
  config: ConstrainedMatcherConfig,
): ConstrainedMatcherResult {
  const normalizedInput = normalizeConstrainedTypedInput(input);
  const expectedSelectionCount = config.expectedSelectionCount;
  const normalizedLabelMap = new Map<string, string>();

  for (const label of config.visibleOptionLabels) {
    const normalizedLabel = normalizeConstrainedTypedInput(label);
    if (normalizedLabel) {
      normalizedLabelMap.set(normalizedLabel, label);
    }
  }

  if (!normalizedInput) {
    return invalidResult("empty_input", normalizedInput);
  }

  if (normalizedLabelMap.size === 0) {
    return invalidResult("unrecognized_input", normalizedInput);
  }

  const tokens = normalizedInput.split(" ").filter(Boolean);
  const selectedNormalizedLabels: string[] = [];

  for (const token of tokens) {
    if (token === "and") {
      continue;
    }

    if (WRAPPER_TOKENS.has(token)) {
      continue;
    }

    if (normalizedLabelMap.has(token)) {
      selectedNormalizedLabels.push(token);
      continue;
    }

    return invalidResult("unrecognized_input", normalizedInput);
  }

  if (selectedNormalizedLabels.length === 0) {
    return invalidResult("unrecognized_input", normalizedInput);
  }

  if (new Set(selectedNormalizedLabels).size !== selectedNormalizedLabels.length) {
    return invalidResult("duplicate_selection", normalizedInput);
  }

  if (
    typeof expectedSelectionCount === "number"
    && selectedNormalizedLabels.length !== expectedSelectionCount
  ) {
    return invalidResult("wrong_selection_count", normalizedInput);
  }

  const selectedLabels = selectedNormalizedLabels
    .map((normalizedLabel) => normalizedLabelMap.get(normalizedLabel))
    .filter((value): value is string => Boolean(value));

  return {
    status: "matched",
    selectedLabels,
    canonicalAnswer: selectedLabels.join(" and "),
    normalizedInput,
  };
}

function invalidResult(
  reason: ConstrainedMatcherInvalidResult["reason"],
  normalizedInput: string,
): ConstrainedMatcherInvalidResult {
  return {
    status: "invalid_input",
    reason,
    normalizedInput,
    recoverableMessage: RECOVERABLE_INVALID_INPUT_MESSAGE,
  };
}
