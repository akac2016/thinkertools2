import "server-only";

import { z } from "zod";

import { parseBody } from "@/lib/api/route-utils";
import { requireActorIdFromRequest } from "@/lib/auth/actor";
import { jsonError, jsonSuccess } from "@/lib/http";
import { missionBodySchema } from "@/lib/authoring/mission-schema";
import { loadActiveMissionBySlug } from "@/lib/missions/server";
import {
  ACTIVE_MISSION_CONTENT_TYPE,
  applyEarnedXp,
  getXpRequiredForNextLevel,
  isMatchingLabelPair,
  normalizeLabelSelection,
  type MissionCompletionRow,
} from "@/lib/quests";
import {
  getOrCreateUserTrainingProgress,
} from "@/lib/quests/server-progress";
import { supabaseAdmin } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ missionSlug: string }>;
};

const completeMissionSchema = z.object({
  selectedContradictionLabels: z.array(z.string().trim().min(1).max(16)).length(2),
  selectedResolutionId: z.string().trim().min(1).max(160),
  completedStageIds: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  revealedFactIds: z.array(z.string().trim().min(1).max(120)).max(40).optional(),
}).strict();

const COMPLETION_SELECT = [
  "id",
  "user_id",
  "training_id",
  "mission_id",
  "content_type",
  "awarded_xp",
  "completion_metadata",
  "completed_at",
].join(",");

function getReplayCount(metadata: Record<string, unknown> | null | undefined): number {
  const replayCount = metadata?.replay_count;
  return typeof replayCount === "number" && Number.isFinite(replayCount)
    ? Math.max(0, replayCount)
    : 0;
}

function createCompletionMetadata(input: {
  missionSlug: string;
  selectedContradictionLabels: string[];
  selectedResolutionId: string;
  correctContradictionLabels: string[];
  bestOptionId: string;
  resolutionOptions: Array<{ id: string; label: string }>;
  completedStageIds: string[];
  revealedFactIds: string[];
}) {
  const selectedResolution = input.resolutionOptions.find(
    (option) => option.id === input.selectedResolutionId,
  );

  return {
    mission_slug: input.missionSlug,
    source: "thinkertools-missions",
    contradiction: {
      selected_labels: input.selectedContradictionLabels,
      correct_answer_labels: [...input.correctContradictionLabels],
      was_correct: true,
    },
    resolution: {
      selected_option_id: input.selectedResolutionId,
      selected_option_label: selectedResolution?.label ?? null,
      best_option_id: input.bestOptionId,
      was_correct: true,
    },
    completed_stage_ids: input.completedStageIds,
    revealed_fact_ids: input.revealedFactIds,
  };
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const params = await context.params;

    // Load the mission from the database (data-driven, replaces hardcoded slug check)
    const missionRow = await loadActiveMissionBySlug(params.missionSlug);
    if (!missionRow) {
      return jsonError("Mission not found", {
        status: 404,
        code: "MISSIONS_NOT_FOUND",
      });
    }

    // Parse and validate the stored mission body
    const body = missionBodySchema.parse(missionRow.mission_body);
    const correctLabels = body.contradiction_review.correct_claim_labels;
    const bestOptionId = body.resolution_review.best_option_id;

    const actor = await requireActorIdFromRequest(request);
    if (!actor.ok) {
      return actor.response;
    }

    const parsedBody = await parseBody(request, completeMissionSchema);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const selectedContradictionLabels = normalizeLabelSelection(parsedBody.data.selectedContradictionLabels);
    if (!isMatchingLabelPair(selectedContradictionLabels, [...correctLabels])) {
      return jsonError("Mission contradiction answer is not complete", {
        status: 422,
        code: "MISSIONS_CONTRADICTION_INCORRECT",
      });
    }

    if (parsedBody.data.selectedResolutionId !== bestOptionId) {
      return jsonError("Mission resolution answer is not complete", {
        status: 422,
        code: "MISSIONS_RESOLUTION_INCORRECT",
      });
    }

    const progress = await getOrCreateUserTrainingProgress({
      userId: actor.actorId,
      trainingId: missionRow.primary_training_id,
    });
    if (!progress.ok) {
      return progress.response;
    }

    const existingCompletionResult = await supabaseAdmin
      .from("mission_completions")
      .select(COMPLETION_SELECT)
      .eq("user_id", actor.actorId)
      .eq("mission_id", missionRow.id)
      .maybeSingle();

    if (existingCompletionResult.error) {
      return jsonError("Failed to load mission completion", {
        status: 500,
        code: "MISSIONS_COMPLETION_LOAD_FAILED",
        details: {
          dbCode: existingCompletionResult.error.code ?? null,
          dbMessage: existingCompletionResult.error.message,
        },
      });
    }

    const currentProgress = {
      currentLevel: progress.data.current_level,
      currentLevelXp: progress.data.current_level_xp,
      totalXp: progress.data.total_xp,
    };
    const completionMetadata = createCompletionMetadata({
      missionSlug: missionRow.slug,
      selectedContradictionLabels,
      selectedResolutionId: parsedBody.data.selectedResolutionId,
      correctContradictionLabels: [...correctLabels],
      bestOptionId,
      resolutionOptions: body.resolution_options.map((o) => ({ id: o.id, label: o.label })),
      completedStageIds: parsedBody.data.completedStageIds ?? [],
      revealedFactIds: parsedBody.data.revealedFactIds ?? [],
    });
    const existingCompletion = existingCompletionResult.data as Pick<MissionCompletionRow,
      | "id"
      | "user_id"
      | "training_id"
      | "mission_id"
      | "content_type"
      | "awarded_xp"
      | "completion_metadata"
      | "completed_at"
    > | null;

    let awardedXp = 0;
    let firstAwardedXp = 0;
    let replayed = false;
    let replayCount = 0;
    let completionAt: string | null = null;
    let updatedProgress = currentProgress;

    if (existingCompletion) {
      replayed = true;
      replayCount = getReplayCount(existingCompletion.completion_metadata) + 1;
      completionAt = existingCompletion.completed_at;
      firstAwardedXp = existingCompletion.awarded_xp;

      const updateReplayResult = await supabaseAdmin
        .from("mission_completions")
        .update({
          completion_metadata: {
            ...existingCompletion.completion_metadata,
            replay_count: replayCount,
            latest_recompletion_at: new Date().toISOString(),
            latest_recompletion: completionMetadata,
          },
        })
        .eq("id", existingCompletion.id);

      if (updateReplayResult.error) {
        return jsonError("Failed to record mission replay", {
          status: 500,
          code: "MISSIONS_REPLAY_RECORD_FAILED",
          details: {
            dbCode: updateReplayResult.error.code ?? null,
            dbMessage: updateReplayResult.error.message,
          },
        });
      }
    } else {
      awardedXp = missionRow.xp_reward;
      firstAwardedXp = awardedXp;
      updatedProgress = applyEarnedXp(currentProgress, awardedXp);

      const insertCompletionResult = await supabaseAdmin
        .from("mission_completions")
        .insert({
          user_id: actor.actorId,
          training_id: missionRow.primary_training_id,
          mission_id: missionRow.id,
          content_type: ACTIVE_MISSION_CONTENT_TYPE,
          awarded_xp: awardedXp,
          completion_metadata: {
            ...completionMetadata,
            replay_count: 0,
          },
        })
        .select("completed_at")
        .single();

      if (insertCompletionResult.error) {
        if (insertCompletionResult.error.code === "23505") {
          awardedXp = 0;
          firstAwardedXp = 0;
          replayed = true;
          replayCount = 1;
        } else {
          return jsonError("Failed to record mission completion", {
            status: 500,
            code: "MISSIONS_COMPLETION_RECORD_FAILED",
            details: {
              dbCode: insertCompletionResult.error.code ?? null,
              dbMessage: insertCompletionResult.error.message,
            },
          });
        }
      } else {
        completionAt = insertCompletionResult.data.completed_at as string;
        const updateProgressResult = await supabaseAdmin
          .from("user_training_progress")
          .update({
            current_level: updatedProgress.currentLevel,
            current_level_xp: updatedProgress.currentLevelXp,
            total_xp: updatedProgress.totalXp,
            updated_at: new Date().toISOString(),
          })
          .eq("id", progress.data.id);

        if (updateProgressResult.error) {
          return jsonError("Failed to update training progress", {
            status: 500,
            code: "MISSIONS_PROGRESS_UPDATE_FAILED",
            details: {
              dbCode: updateProgressResult.error.code ?? null,
              dbMessage: updateProgressResult.error.message,
            },
          });
        }
      }
    }

    if (replayed) {
      updatedProgress = currentProgress;
    }

    const xpRequiredForNextLevel = getXpRequiredForNextLevel(updatedProgress.currentLevel);

    // Derive the next recommended activity slug from rewards_metadata (set at catalog sync time).
    const nextRecommendedActivitySlug =
      typeof missionRow.rewards_metadata?.next_recommended_activity_slug === "string"
        ? missionRow.rewards_metadata.next_recommended_activity_slug
        : null;

    return jsonSuccess({
      mission: {
        id: missionRow.id,
        slug: missionRow.slug,
        title: missionRow.title,
        xpReward: missionRow.xp_reward,
      },
      completion: {
        isCompleted: true,
        completedAt: completionAt,
        awardedXp,
        firstAwardedXp,
        replayed,
        replayCount,
        canReplay: true,
      },
      progress: {
        currentLevel: updatedProgress.currentLevel,
        currentLevelXp: updatedProgress.currentLevelXp,
        totalXp: updatedProgress.totalXp,
        xpRequiredForNextLevel,
        xpRemainingForNextLevel: xpRequiredForNextLevel > 0
          ? Math.max(0, xpRequiredForNextLevel - updatedProgress.currentLevelXp)
          : 0,
        leveledUp: updatedProgress.currentLevel > currentProgress.currentLevel,
      },
      nextRecommendedActivitySlug,
    });
  } catch (error) {
    return jsonError("Unexpected error while completing mission", {
      status: 500,
      code: "MISSIONS_COMPLETE_UNEXPECTED",
      details: {
        reason: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}
