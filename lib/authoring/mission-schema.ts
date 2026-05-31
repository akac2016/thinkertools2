import { z } from "zod";

// ── Leaf schemas ──────────────────────────────────────────────────────────────

export const missionFactSchema = z
  .object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1),
    body: z.string().trim().min(1),
  })
  .strict();

export const missionActionSchema = z
  .object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1),
    kind: z.enum([
      "continue",
      "inspect",
      "select-contradiction",
      "select-resolution",
      "complete",
      "handoff",
    ]),
    target_stage_id: z.string().trim().min(1).optional(),
  })
  .strict();

export const missionStageSchema = z
  .object({
    id: z.string().trim().min(1),
    title: z.string().trim().min(1),
    objective: z.string().trim().min(1),
    guide_messages: z.array(z.string().trim().min(1)).min(1),
    action_ids: z.array(z.string().trim().min(1)).min(1),
    revealed_fact_ids: z.array(z.string().trim().min(1)),
  })
  .strict();

export const missionClaimSchema = z
  .object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1).max(16),
    character_name: z.string().trim().min(1),
    role: z.string().trim().min(1),
    statement: z.string().trim().min(1),
    revealed_fact_ids: z.array(z.string().trim().min(1)),
  })
  .strict();

export const contradictionReviewSchema = z
  .object({
    stage_id: z.string().trim().min(1),
    prompt: z.string().trim().min(1),
    claim_ids: z.array(z.string().trim().min(1)).min(2),
    correct_claim_labels: z.array(z.string().trim().min(1).max(16)).min(1).max(2),
    correct_claim_ids: z.array(z.string().trim().min(1)).min(1).max(2),
    explanation: z.string().trim().min(1),
  })
  .strict();

export const resolutionOptionSchema = z
  .object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1).max(16),
    body: z.string().trim().min(1),
    feedback: z.string().trim().min(1),
  })
  .strict();

export const resolutionReviewSchema = z
  .object({
    stage_id: z.string().trim().min(1),
    prompt: z.string().trim().min(1),
    option_ids: z.array(z.string().trim().min(1)).min(2),
    best_option_id: z.string().trim().min(1),
    explanation: z.string().trim().min(1),
  })
  .strict();

export const debriefSchema = z
  .object({
    completion_message: z.string().trim().min(1),
    takeaway: z.string().trim().min(1),
    handoff_message: z.string().trim().min(1),
  })
  .strict();

// ── Top-level mission body schema ─────────────────────────────────────────────

export const missionBodySchema = z
  .object({
    narrative_hook: z.string().trim().min(1),
    short_description: z.string().trim().min(1),
    difficulty_label: z.string().trim().min(1),
    required_training_level: z.number().int().min(1).max(20),
    xp_reward: z.number().int().min(0),
    stages: z.array(missionStageSchema).min(2),
    actions: z.array(missionActionSchema).min(1),
    facts: z.array(missionFactSchema),
    character_claims: z.array(missionClaimSchema).min(2),
    contradiction_review: contradictionReviewSchema,
    resolution_options: z.array(resolutionOptionSchema).min(2),
    resolution_review: resolutionReviewSchema,
    debrief: debriefSchema,
  })
  .strict();

export type MissionFact = z.infer<typeof missionFactSchema>;
export type MissionAction = z.infer<typeof missionActionSchema>;
export type MissionStage = z.infer<typeof missionStageSchema>;
export type MissionClaim = z.infer<typeof missionClaimSchema>;
export type ContradictionReview = z.infer<typeof contradictionReviewSchema>;
export type ResolutionOption = z.infer<typeof resolutionOptionSchema>;
export type ResolutionReview = z.infer<typeof resolutionReviewSchema>;
export type Debrief = z.infer<typeof debriefSchema>;
export type MissionBody = z.infer<typeof missionBodySchema>;
