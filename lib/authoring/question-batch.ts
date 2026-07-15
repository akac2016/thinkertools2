const LIST_MARKER = /^\s*(?:[-*•]|\d+[.)])\s+/;
const QUESTION_START = /^(?:who|what|when|where|why|how|which|can|could|should|would|is|are|do|does|did|explain|compare|evaluate|identify|describe)\b/i;

function cleanQuestion(value: string): string {
  return value.replace(LIST_MARKER, "").replace(/\s+/g, " ").trim();
}

/**
 * Returns the individual prompts when input looks like a pasted question list.
 * Ordinary prose and a single question return null so normal authoring can
 * continue without an extra confirmation step.
 */
export function extractPastedQuestionBatch(input: string): string[] | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const questionMarkItems = (trimmed.match(/[^?]+\?/g) ?? [])
    .map(cleanQuestion)
    .filter(Boolean);
  if (questionMarkItems.length >= 2) return questionMarkItems;

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;

  const markedLines = lines.filter((line) => LIST_MARKER.test(line));
  if (markedLines.length >= 2) {
    return markedLines.map(cleanQuestion).filter(Boolean);
  }

  const questionLikeLines = lines.filter(
    (line) => line.endsWith("?") || QUESTION_START.test(cleanQuestion(line)),
  );
  return questionLikeLines.length >= 2
    ? questionLikeLines.map(cleanQuestion).filter(Boolean)
    : null;
}

