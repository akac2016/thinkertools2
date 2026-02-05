import { z } from "zod";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "with",
]);

const nonEmptyText = (max: number) => z.string().trim().min(1).max(max);

const sentenceText = z.string().trim().min(1).max(300);

export const aiFeatureSchema = z.enum([
  "template_generation",
  "turn_assist",
  "summary",
]);

export type AiFeature = z.infer<typeof aiFeatureSchema>;

export const DEFAULT_AI_MODEL = "gpt-4o-mini";
export const MOCK_AI_MODEL = "mock-deterministic-v1";

export const templateRequestSchema = z
  .object({
    goal: nonEmptyText(1000),
    audience: nonEmptyText(160).default("general audience"),
    tone: z.enum(["neutral", "friendly", "formal"]).default("neutral"),
    format: z.enum(["email", "doc", "checklist"]).default("doc"),
    constraints: z.array(nonEmptyText(240)).max(8).default([]),
    include_sections: z.array(nonEmptyText(120)).max(8).default([]),
  })
  .strict();

export const templateResponseSchema = z
  .object({
    title: sentenceText.max(180),
    template: z.string().trim().min(1).max(5000),
    variables: z.array(nonEmptyText(80)).max(8),
    tips: z.array(sentenceText).max(6),
  })
  .strict();

export type TemplateRequest = z.infer<typeof templateRequestSchema>;
export type TemplateResponse = z.infer<typeof templateResponseSchema>;

const turnMessageSchema = z
  .object({
    role: z.enum(["system", "user", "assistant"]),
    content: nonEmptyText(2000),
  })
  .strict();

export const turnRequestSchema = z
  .object({
    conversation: z.array(turnMessageSchema).min(1).max(30),
    user_input: nonEmptyText(1200),
    intent: z.enum(["reply", "rewrite", "clarify"]).default("reply"),
    style: z.enum(["concise", "balanced", "detailed"]).default("balanced"),
  })
  .strict();

export const turnResponseSchema = z
  .object({
    assistant_message: z.string().trim().min(1).max(2000),
    suggestions: z.array(sentenceText).max(5),
    safety_notes: z.array(sentenceText).max(4),
  })
  .strict();

export type TurnRequest = z.infer<typeof turnRequestSchema>;
export type TurnResponse = z.infer<typeof turnResponseSchema>;

export const summaryRequestSchema = z
  .object({
    content: nonEmptyText(12000),
    max_bullets: z.number().int().min(1).max(8).default(4),
    include_action_items: z.boolean().default(true),
  })
  .strict();

export const summaryResponseSchema = z
  .object({
    summary: z.string().trim().min(1).max(500),
    bullets: z.array(sentenceText).min(1).max(8),
    action_items: z.array(sentenceText).max(6),
  })
  .strict();

export type SummaryRequest = z.infer<typeof summaryRequestSchema>;
export type SummaryResponse = z.infer<typeof summaryResponseSchema>;

export function formatValidationIssues(error: z.ZodError) {
  return error.issues.map((issue) => ({
    code: issue.code,
    message: issue.message,
    path: issue.path.join("."),
  }));
}

function clip(text: string, max: number) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length <= max
    ? normalized
    : `${normalized.slice(0, Math.max(0, max - 1))}...`;
}

function splitWords(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 && !STOP_WORDS.has(part));
}

function uniqueWords(texts: string[], max: number) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const text of texts) {
    for (const word of splitWords(text)) {
      if (seen.has(word)) {
        continue;
      }

      seen.add(word);
      output.push(word);

      if (output.length >= max) {
        return output;
      }
    }
  }

  return output;
}

function splitSentences(text: string) {
  const sentenceParts = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (sentenceParts.length > 0) {
    return sentenceParts;
  }

  return [clip(text, 220)];
}

export function buildTemplateMock(input: TemplateRequest): TemplateResponse {
  const sections =
    input.include_sections.length > 0
      ? input.include_sections
      : ["Goal", "Audience", "Key Points", "Next Steps"];

  const keywords = uniqueWords(
    [input.goal, input.audience, ...input.constraints, ...sections],
    6,
  );

  const variables = (keywords.length > 0 ? keywords : ["topic", "deadline", "owner"]).map(
    (word) => `{{${word}}}`,
  );

  const bodyLines = sections.map((section, index) => {
    const variable = variables[index % variables.length] ?? "{{detail}}";
    return `${section}: ${variable}`;
  });

  const tips = [
    `Keep tone ${input.tone} and structure suited for a ${input.format}.`,
    input.constraints[0]
      ? `Honor this constraint first: ${clip(input.constraints[0], 120)}`
      : "Start with a clear objective in the first line.",
    "Replace placeholders before sending.",
  ];

  return templateResponseSchema.parse({
    title: `Template for ${clip(input.goal, 80)}`,
    template: [
      `Format: ${input.format}`,
      `Tone: ${input.tone}`,
      `Audience: ${input.audience}`,
      "",
      ...bodyLines,
    ].join("\n"),
    variables,
    tips,
  });
}

function stylePrefix(style: TurnRequest["style"]) {
  if (style === "concise") {
    return "Short reply";
  }

  if (style === "detailed") {
    return "Detailed reply";
  }

  return "Balanced reply";
}

export function buildTurnMock(input: TurnRequest): TurnResponse {
  const latestMessage = input.conversation[input.conversation.length - 1];
  const focusWords = uniqueWords([input.user_input, latestMessage.content], 3);
  const focusText = focusWords.length > 0 ? focusWords.join(", ") : "the key point";

  let assistantMessage = "";
  if (input.intent === "rewrite") {
    assistantMessage = `Rewritten (${input.style}): ${clip(input.user_input, 220)}`;
  } else if (input.intent === "clarify") {
    assistantMessage = `${stylePrefix(input.style)}: Could you clarify ${focusText}?`;
  } else {
    assistantMessage = `${stylePrefix(input.style)}: ${clip(input.user_input, 240)}`;
  }

  return turnResponseSchema.parse({
    assistant_message: assistantMessage,
    suggestions: [
      `Reference context from the last ${Math.min(input.conversation.length, 3)} turns.`,
      `Keep emphasis on ${focusText}.`,
      "End with a concrete next step.",
    ],
    safety_notes: [
      "Avoid sharing sensitive personal or account data.",
      "Verify facts before sending final guidance.",
    ],
  });
}

export function buildSummaryMock(input: SummaryRequest): SummaryResponse {
  const sentences = splitSentences(input.content);
  const bullets = sentences.slice(0, input.max_bullets).map((sentence) => clip(sentence, 180));

  const actionCandidates = sentences
    .filter((sentence) => /\b(should|must|need|todo|action|next)\b/i.test(sentence))
    .slice(0, 4)
    .map((sentence) => `Action: ${clip(sentence, 150)}`);

  const actionItems = input.include_action_items
    ? actionCandidates.length > 0
      ? actionCandidates
      : bullets.slice(0, Math.min(2, bullets.length)).map((bullet) => `Review: ${bullet}`)
    : [];

  return summaryResponseSchema.parse({
    summary: clip(sentences[0] ?? input.content, 260),
    bullets: bullets.length > 0 ? bullets : [clip(input.content, 180)],
    action_items: actionItems,
  });
}
