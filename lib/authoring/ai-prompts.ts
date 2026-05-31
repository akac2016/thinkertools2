/**
 * Prompt builders and deterministic mocks for the authoring AI layer.
 *
 * Two modes are supported:
 *   A) Single-shot generation  — buildAuthoringSystemPrompt / buildAuthoringUserPrompt
 *   B) Conversational refinement — buildRefineSystemPrompt / buildRefineUserPrompt
 *
 * buildAuthoringMock provides a deterministic fallback body so the flow works
 * without an API key, mirroring the buildTemplateMock / buildTurnMock / buildSummaryMock
 * pattern in lib/ai/schemas.ts.
 */

import type { DraftContentType } from "@/lib/authoring/draft-types";

// ---------------------------------------------------------------------------
// Internal helpers (mirrors the clip / splitWords helpers in lib/ai/schemas.ts)
// ---------------------------------------------------------------------------

function clip(text: string, max: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length <= max
    ? normalized
    : `${normalized.slice(0, Math.max(0, max - 1))}…`;
}

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
  "in", "is", "it", "of", "on", "or", "that", "the", "to", "with",
]);

function contentWords(text: string, max: number): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    if (!seen.has(w)) {
      seen.add(w);
      out.push(w);
      if (out.length >= max) break;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Activity system prompt
// ---------------------------------------------------------------------------

const ACTIVITY_SCHEMA_DESCRIPTION = `
{
  "round_type": "activity_standard",
  "question_text": "<string, 1-300 chars — the question posed to the learner>",
  "prompt_claims": [
    "<Claim A — string, 1-300 chars>",
    "<Claim B — string, 1-300 chars>",
    "<Claim C — string, 1-300 chars>",
    "<Claim D — string, 1-300 chars>"
  ],
  "correct_answer_labels": ["<label matching a claim, e.g. A>", "<label matching a claim, e.g. C>"],
  "explanation": "<string, 1-600 chars — why those claims contradict>",
  "expected_answer_count": 2
}
`.trim();

const MISSION_SCHEMA_DESCRIPTION = `
{
  "narrative_hook": "<string — opening story hook>",
  "short_description": "<string — one-sentence summary>",
  "difficulty_label": "<string — e.g. Beginner>",
  "required_training_level": 1,
  "xp_reward": 100,
  "stages": [
    { "id": "<stageId>", "title": "<string>", "body": "<string>" },
    ...
  ],
  "actions": [
    { "id": "<actionId>", "stageId": "<stageId>", "label": "<string>", "kind": "advance|complete", "targetStageId": "<stageId or null>" },
    ...
  ],
  "facts": [],
  "character_claims": [
    { "label": "<A>", "character": "<name>", "text": "<claim text>" },
    ...
  ],
  "contradiction_review": {
    "prompt": "<string>",
    "correct_claim_labels": ["<A>", "<B>"]
  },
  "resolution_options": [
    { "id": "<optionId>", "text": "<string>" },
    ...
  ],
  "resolution_review": {
    "best_option_id": "<optionId>",
    "explanation": "<string>"
  },
  "debrief": {
    "title": "<string>",
    "body": "<string>"
  }
}
`.trim();

// ---------------------------------------------------------------------------
// Mode A — single-shot generation
// ---------------------------------------------------------------------------

/**
 * System prompt for single-shot generation.
 *
 * @param contentType  'activity' or 'mission'
 * @param trainingContext  Optional extra context about the training track (e.g. topic, audience)
 */
export function buildAuthoringSystemPrompt(
  contentType: DraftContentType,
  trainingContext?: string,
): string {
  const contextBlock = trainingContext
    ? `\n\nTraining context provided by the educator:\n${trainingContext.trim()}`
    : "";

  if (contentType === "activity") {
    return `You are an expert instructional designer creating short practice drills for learners.
Your task is to produce a single claim-based practice drill in valid JSON.

The drill presents the learner with a set of statements (claims) about a topic and asks them to identify which claim or pair of claims best fits a specific criterion — such as which claims contradict each other, which claim is unsupported, which claim is the strongest, or which claim is the odd one out. The question_text defines what the learner is looking for.

Rules:
- Output ONLY the JSON object — no markdown fences, no commentary.
- The JSON must conform exactly to this schema:
${ACTIVITY_SCHEMA_DESCRIPTION}
- prompt_claims must contain between 2 and 8 items.
- Each claim must be assigned a unique single-letter label (A, B, C, …) in the order it appears.
- correct_answer_labels must reference labels that exist in prompt_claims.
- The number of entries in correct_answer_labels must equal expected_answer_count.
- expected_answer_count must be 1 or 2.
- All string fields must be non-empty.
- question_text must clearly ask the learner what to identify (e.g. "Which two claims contradict each other?", "Which claim is unsupported by the evidence?", "Which claim is the odd one out?").
- explanation must explain why the correct answer(s) are correct.
- Base the content on the educator's description — use their topic, scenario, and framing.${contextBlock}`;
  }

  // contentType === 'mission'
  return `You are an expert instructional designer specialising in story-driven learning missions.
Your task is to produce a complete mission definition in valid JSON.

Rules:
- Output ONLY the JSON object — no markdown fences, no commentary.
- The JSON must conform exactly to this schema:
${MISSION_SCHEMA_DESCRIPTION}
- stages must contain at least 2 entries; the last reachable stage must be the debrief.
- Every action's stageId must reference an existing stage id.
- Every action with kind "advance" must have a targetStageId that references an existing stage id.
- There must be at least one action with kind "complete" that leads to the debrief.
- character_claims must contain at least 2 entries with unique single-letter labels (A, B, …).
- contradiction_review.correct_claim_labels must reference labels that exist in character_claims.
- resolution_review.best_option_id must reference an id that exists in resolution_options.
- All string fields must be non-empty.${contextBlock}`;
}

/**
 * User prompt for single-shot generation — wraps the educator's description.
 */
export function buildAuthoringUserPrompt(description: string): string {
  return `Create the content described below. Return only the JSON object.\n\n${description.trim()}`;
}

// ---------------------------------------------------------------------------
// Mode B — conversational refinement
// ---------------------------------------------------------------------------

/**
 * System prompt for conversational refinement.
 *
 * @param contentType  'activity' or 'mission'
 */
export function buildRefineSystemPrompt(contentType: DraftContentType): string {
  const schemaBlock =
    contentType === "activity" ? ACTIVITY_SCHEMA_DESCRIPTION : MISSION_SCHEMA_DESCRIPTION;

  return `You are an expert instructional designer helping an educator refine an existing ${contentType === "activity" ? "practice drill" : "mission"} draft.
You will receive the current draft (as JSON) and a single refinement instruction.

Rules:
- Apply the instruction to the draft.
- Return the COMPLETE revised object — not a diff, not a partial update.
- Preserve every part of the draft that the instruction does not address.
- The returned JSON must conform exactly to this schema:
${schemaBlock}
- Output ONLY the JSON object — no markdown fences, no commentary.
- If the instruction is ambiguous or cannot be applied without violating the schema, return the original draft unchanged.`;
}

/**
 * User prompt for conversational refinement — includes the current draft body and the instruction.
 */
export function buildRefineUserPrompt(currentBody: unknown, instruction: string): string {
  return `Current draft:\n${JSON.stringify(currentBody, null, 2)}\n\nRefinement instruction:\n${instruction.trim()}`;
}

// ---------------------------------------------------------------------------
// Deterministic mock
// ---------------------------------------------------------------------------

/**
 * Returns a deterministic mock body that conforms to the activity or mission schema.
 * Used as the mockResponse for runStructuredAi so the flow works without an API key.
 *
 * The content is derived from the description text so repeated calls with the same
 * inputs produce the same output (deterministic), mirroring buildTemplateMock et al.
 */
export function buildAuthoringMock(
  contentType: DraftContentType,
  description: string,
): unknown {
  const words = contentWords(description, 8);
  const topic = words.length > 0 ? words.slice(0, 3).join(" ") : "the topic";
  const clippedDesc = clip(description, 120);

  if (contentType === "activity") {
    return buildActivityMock(topic, clippedDesc, words);
  }

  return buildMissionMock(topic, clippedDesc, words);
}

function buildActivityMock(
  topic: string,
  clippedDesc: string,
  words: string[],
): unknown {
  const w = (i: number, fallback: string) => words[i] ?? fallback;

  const claims = [
    `${clip(w(0, "Claim"), 60)} increases ${clip(w(1, "outcomes"), 60)} significantly.`,
    `${clip(w(0, "Claim"), 60)} has no measurable effect on ${clip(w(1, "outcomes"), 60)}.`,
    `${clip(w(2, "Evidence"), 60)} supports the view that ${clip(w(3, "results"), 60)} improve.`,
    `${clip(w(2, "Evidence"), 60)} shows ${clip(w(3, "results"), 60)} remain unchanged.`,
  ];

  return {
    round_type: "activity_standard",
    question_text: `Which two claims about ${topic} directly contradict each other?`,
    prompt_claims: claims,
    correct_answer_labels: ["A", "B"],
    explanation: `Claims A and B directly contradict each other regarding ${clippedDesc}.`,
    expected_answer_count: 2,
  };
}

function buildMissionMock(
  topic: string,
  clippedDesc: string,
  words: string[],
): unknown {
  const w = (i: number, fallback: string) => words[i] ?? fallback;

  const stage1Id = "stage-intro";
  const stage2Id = "stage-debrief";
  const action1Id = "action-advance";
  const action2Id = "action-complete";
  const claim1Id = "claim-a";
  const claim2Id = "claim-b";
  const option1Id = "option-a";
  const option2Id = "option-b";

  return {
    narrative_hook: `A mystery surrounds ${topic}. Can you uncover the truth?`,
    short_description: clip(clippedDesc, 120),
    difficulty_label: "Beginner",
    required_training_level: 1,
    xp_reward: 100,
    stages: [
      {
        id: stage1Id,
        title: `Introduction: ${clip(w(0, topic), 40)}`,
        objective: `Investigate ${topic} and review the evidence carefully.`,
        guide_messages: [`You have been asked to investigate ${topic}.`],
        action_ids: [action1Id],
        revealed_fact_ids: [],
      },
      {
        id: stage2Id,
        title: "Debrief",
        objective: `Reflect on what you discovered about ${topic}.`,
        guide_messages: [`Well done. You identified the contradiction about ${topic}.`],
        action_ids: [action2Id],
        revealed_fact_ids: [],
      },
    ],
    actions: [
      {
        id: action1Id,
        label: "Continue",
        kind: "continue",
        target_stage_id: stage2Id,
      },
      {
        id: action2Id,
        label: "Finish",
        kind: "complete",
      },
    ],
    facts: [],
    character_claims: [
      {
        id: claim1Id,
        label: "A",
        character_name: clip(w(1, "Agent"), 40),
        role: "Investigator",
        statement: `${clip(w(0, topic), 60)} leads to better ${clip(w(2, "outcomes"), 60)}.`,
        revealed_fact_ids: [],
      },
      {
        id: claim2Id,
        label: "B",
        character_name: clip(w(3, "Analyst"), 40),
        role: "Analyst",
        statement: `${clip(w(0, topic), 60)} has no effect on ${clip(w(2, "outcomes"), 60)}.`,
        revealed_fact_ids: [],
      },
    ],
    contradiction_review: {
      stage_id: stage1Id,
      prompt: `Which two claims about ${topic} contradict each other?`,
      claim_ids: [claim1Id, claim2Id],
      correct_claim_labels: ["A", "B"],
      correct_claim_ids: [claim1Id, claim2Id],
      explanation: `Claims A and B directly contradict each other regarding ${topic}.`,
    },
    resolution_options: [
      {
        id: option1Id,
        label: "A",
        body: `Trust the evidence about ${clip(w(0, topic), 40)}.`,
        feedback: "Correct — evidence-based reasoning is key.",
      },
      {
        id: option2Id,
        label: "B",
        body: "Dismiss the evidence and rely on intuition.",
        feedback: "Incorrect — dismissing evidence is not sound reasoning.",
      },
    ],
    resolution_review: {
      stage_id: stage2Id,
      prompt: `What is the right approach when evaluating ${topic}?`,
      option_ids: [option1Id, option2Id],
      best_option_id: option1Id,
      explanation: `Trusting the evidence is the correct approach when evaluating ${topic}.`,
    },
    debrief: {
      completion_message: `You successfully identified the contradiction about ${clippedDesc}.`,
      takeaway: `Always evaluate evidence carefully when investigating ${topic}.`,
      handoff_message: "Return to the main menu.",
    },
  };
}
