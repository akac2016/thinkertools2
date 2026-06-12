import "server-only";

import { requireActorIdFromRequest } from "@/lib/auth/actor";
import { jsonError, jsonSuccess } from "@/lib/http";
import { missionBodySchema } from "@/lib/authoring/mission-schema";
import { loadActiveMissionBySlug } from "@/lib/missions/server";
import type { MissionDefinition } from "@/lib/missions/domain-types";

type RouteContext = {
  params: Promise<{ missionSlug: string }>;
};

/**
 * Map the snake_case stored mission_body to the camelCase MissionDefinition
 * shape the frontend components expect.
 */
function missionBodyToDefinition(
  slug: string,
  title: string,
  xpReward: number,
  rewardsMetadata: Record<string, unknown> | null,
  body: ReturnType<typeof missionBodySchema.parse>,
): MissionDefinition {
  return {
    id: slug,
    slug,
    title,
    // trainingSlug / trainingTitle are not stored in mission_body; derive from rewards_metadata
    trainingSlug:
      typeof rewardsMetadata?.training_slug === "string"
        ? rewardsMetadata.training_slug
        : "philosophical-reasoning",
    trainingTitle:
      typeof rewardsMetadata?.source_title === "string"
        ? rewardsMetadata.source_title
        : "Philosophical Reasoning",
    missionType:
      typeof rewardsMetadata?.mission_type === "string"
        ? rewardsMetadata.mission_type
        : "Mission",
    narrativeHook: body.narrative_hook,
    shortDescription: body.short_description,
    difficultyLabel: body.difficulty_label,
    requiredTrainingLevel: body.required_training_level,
    xpReward,
    completionCriteria: "",
    nextRecommendedActivitySlug:
      typeof rewardsMetadata?.next_recommended_activity_slug === "string"
        ? rewardsMetadata.next_recommended_activity_slug
        : "",
    source: { title: "", note: "" },
    stages: body.stages.map((s) => ({
      id: s.id,
      title: s.title,
      objective: s.objective,
      guideMessages: s.guide_messages,
      actionIds: s.action_ids,
      revealedFactIds: s.revealed_fact_ids,
    })),
    actions: body.actions.map((a) => ({
      id: a.id,
      label: a.label,
      kind: a.kind,
      ...(a.target_stage_id ? { targetStageId: a.target_stage_id } : {}),
    })),
    facts: body.facts.map((f) => ({
      id: f.id,
      label: f.label,
      body: f.body,
    })),
    characterClaims: body.character_claims.map((c) => ({
      id: c.id,
      label: c.label as "A" | "B" | "C" | "D",
      characterName: c.character_name,
      role: c.role,
      statement: c.statement,
      revealedFactIds: c.revealed_fact_ids,
    })),
    contradictionReview: {
      stageId: body.contradiction_review.stage_id,
      prompt: body.contradiction_review.prompt,
      claimIds: body.contradiction_review.claim_ids,
      correctClaimLabels: body.contradiction_review.correct_claim_labels as unknown as readonly ["A", "C"],
      correctClaimIds: body.contradiction_review.correct_claim_ids as unknown as readonly [string, string],
      explanation: body.contradiction_review.explanation,
    },
    resolutionOptions: body.resolution_options.map((o) => ({
      id: o.id,
      label: o.label,
      body: o.body,
      feedback: o.feedback,
    })),
    resolutionReview: {
      stageId: body.resolution_review.stage_id,
      prompt: body.resolution_review.prompt,
      optionIds: body.resolution_review.option_ids,
      bestOptionId: body.resolution_review.best_option_id,
      explanation: body.resolution_review.explanation,
    },
    debrief: {
      completionMessage: body.debrief.completion_message,
      takeaway: body.debrief.takeaway,
      handoffMessage: body.debrief.handoff_message,
    },
  };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const params = await context.params;

    const actor = await requireActorIdFromRequest(request);
    if (!actor.ok) {
      return actor.response;
    }

    const missionRow = await loadActiveMissionBySlug(params.missionSlug);
    if (!missionRow) {
      return jsonError("Mission not found", {
        status: 404,
        code: "MISSIONS_NOT_FOUND",
      });
    }

    const body = missionBodySchema.safeParse(missionRow.mission_body);
    if (!body.success) {
      return jsonError("Mission body is invalid", {
        status: 500,
        code: "MISSIONS_BODY_INVALID",
        details: { issues: body.error.issues },
      });
    }

    const definition = missionBodyToDefinition(
      missionRow.slug,
      missionRow.title,
      missionRow.xp_reward,
      missionRow.rewards_metadata,
      body.data,
    );

    return jsonSuccess({ definition });
  } catch (error) {
    return jsonError("Unexpected error while loading mission", {
      status: 500,
      code: "MISSIONS_LOAD_UNEXPECTED",
      details: {
        reason: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}
