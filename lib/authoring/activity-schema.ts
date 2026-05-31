import { z } from "zod";

import { normalizeLabelSelection, extractPromptClaims } from "../quests/contradiction-spotting.ts";

export const SUPPORTED_ANSWER_COUNTS = [1, 2] as const;

export const activityBodySchema = z
  .object({
    round_type: z.string().trim().min(1).default("activity_standard"),
    question_text: z.string().trim().min(1).max(300),
    prompt_claims: z.array(z.string().trim().min(1).max(300)).min(2).max(8),
    correct_answer_labels: z.array(z.string().trim().min(1).max(16)).min(1).max(2),
    explanation: z.string().trim().min(1).max(600),
    expected_answer_count: z.number().int().min(1).max(2).default(2),
  })
  .strict()
  // Refinement 1: correct_answer_labels count must match expected_answer_count
  .refine((b) => b.correct_answer_labels.length === b.expected_answer_count, {
    path: ["correct_answer_labels"],
    message: "Correct labels must match expected count",
  })
  // Refinement 2: every correct label must resolve to a label present in prompt_claims
  .refine(
    (b) => {
      // Parse the prompt claims to extract their labels (reuses existing normalization logic)
      const parsedClaims = extractPromptClaims({ prompt_claims: b.prompt_claims } as Parameters<typeof extractPromptClaims>[0]);
      const claimLabelSet = new Set(parsedClaims.map((c) => c.label));

      // Normalize the correct answer labels and check each resolves to a claim label
      const normalizedCorrect = normalizeLabelSelection(b.correct_answer_labels);
      return normalizedCorrect.every((label) => claimLabelSet.has(label));
    },
    {
      path: ["correct_answer_labels"],
      message: "Every correct answer label must reference an existing prompt claim label",
    }
  );

export type ActivityBody = z.infer<typeof activityBodySchema>;
