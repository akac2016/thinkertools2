import "server-only";

import { jsonError, jsonSuccess } from "@/lib/http";
import { requireActorIdFromRequest } from "@/lib/auth/actor";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  ACTIVE_TRAINING_SLUG,
  TRAINING_ACTIVITY_CONTENT_TYPE,
  extractExpectedAnswerCount,
  extractPromptClaims,
  extractQuestionText,
  extractRoundTypeTag,
  getXpRequiredForNextLevel,
  type TrainingActivityRow,
  type TrainingRow,
} from "@/lib/quests";
import {
  getActiveTrainingBySlug,
  getOrCreateUserTrainingProgress,
} from "@/lib/quests/server-progress";

const ACTIVITY_SELECT = [
  "id",
  "slug",
  "title",
  "short_description",
  "difficulty_label",
  "xp_reward",
  "recommended_level_min",
  "recommended_level_max",
  "round_content",
].join(",");

export async function GET(request: Request) {
  try {
    const actor = await requireActorIdFromRequest(request);
    if (!actor.ok) {
      return actor.response;
    }

    const training = await getActiveTrainingBySlug(ACTIVE_TRAINING_SLUG);
    if (!training.ok) {
      return training.response;
    }

    const progress = await getOrCreateUserTrainingProgress({
      userId: actor.actorId,
      trainingId: training.data.id,
    });

    if (!progress.ok) {
      return progress.response;
    }

    const trainingsResult = await supabaseAdmin
      .from("trainings")
      .select("id,slug,title,max_level,is_active")
      .order("created_at", { ascending: true })
      .returns<Pick<TrainingRow, "id" | "slug" | "title" | "max_level" | "is_active">[]>();

    if (trainingsResult.error) {
      return jsonError("Failed to load training catalog", {
        status: 500,
        code: "MISSIONS_TRAINING_CATALOG_LOAD_FAILED",
        details: {
          dbCode: trainingsResult.error.code ?? null,
          dbMessage: trainingsResult.error.message,
        },
      });
    }

    const activitiesResult = await supabaseAdmin
      .from("training_activities")
      .select(ACTIVITY_SELECT)
      .eq("primary_training_id", training.data.id)
      .eq("content_type", TRAINING_ACTIVITY_CONTENT_TYPE)
      .eq("is_active", true)
      .order("recommended_level_min", { ascending: true })
      .order("recommended_level_max", { ascending: true })
      .order("slug", { ascending: true })
      .returns<Pick<TrainingActivityRow,
        | "id"
        | "slug"
        | "title"
        | "short_description"
        | "difficulty_label"
        | "xp_reward"
        | "recommended_level_min"
        | "recommended_level_max"
        | "round_content"
      >[]>();

    if (activitiesResult.error) {
      return jsonError("Failed to load contradiction rounds", {
        status: 500,
        code: "MISSIONS_ACTIVITY_LOAD_FAILED",
        details: {
          dbCode: activitiesResult.error.code ?? null,
          dbMessage: activitiesResult.error.message,
        },
      });
    }

    const rounds = (activitiesResult.data ?? []).map((activity) => ({
      id: activity.id,
      slug: activity.slug,
      title: activity.title,
      shortDescription: activity.short_description,
      difficultyLabel: activity.difficulty_label,
      xpReward: activity.xp_reward,
      recommendedLevelMin: activity.recommended_level_min,
      recommendedLevelMax: activity.recommended_level_max,
      roundType: extractRoundTypeTag(activity.round_content),
      questionText: extractQuestionText(activity.round_content),
      promptClaims: extractPromptClaims(activity.round_content),
      expectedAnswerCount: extractExpectedAnswerCount(activity.round_content),
    }));

    const activitySlugById = new Map(rounds.map((round) => [round.id, round.slug]));
    let completedRoundSlugs: string[] = [];

    if (rounds.length > 0) {
      const completedAttemptsResult = await supabaseAdmin
        .from("training_activity_attempts")
        .select("training_activity_id")
        .eq("user_id", actor.actorId)
        .eq("training_id", training.data.id)
        .eq("content_type", TRAINING_ACTIVITY_CONTENT_TYPE)
        .eq("was_successful", true)
        .in("training_activity_id", rounds.map((round) => round.id));

      if (completedAttemptsResult.error) {
        return jsonError("Failed to load completed contradiction rounds", {
          status: 500,
          code: "MISSIONS_COMPLETED_ROUNDS_LOAD_FAILED",
          details: {
            dbCode: completedAttemptsResult.error.code ?? null,
            dbMessage: completedAttemptsResult.error.message,
          },
        });
      }

      completedRoundSlugs = Array.from(
        new Set(
          (completedAttemptsResult.data ?? [])
            .map((attempt) => activitySlugById.get(attempt.training_activity_id as string))
            .filter((slug): slug is string => Boolean(slug)),
        ),
      );
    }

    const xpRequiredForNextLevel = getXpRequiredForNextLevel(progress.data.current_level);

    return jsonSuccess({
      training: {
        id: training.data.id,
        slug: training.data.slug,
        title: training.data.title,
      },
      progress: {
        currentLevel: progress.data.current_level,
        currentLevelXp: progress.data.current_level_xp,
        totalXp: progress.data.total_xp,
        xpRequiredForNextLevel,
        xpRemainingForNextLevel: xpRequiredForNextLevel > 0
          ? Math.max(0, xpRequiredForNextLevel - progress.data.current_level_xp)
          : 0,
      },
      trainingCatalog: (trainingsResult.data ?? []).map((entry) => ({
        id: entry.id,
        slug: entry.slug,
        title: entry.title,
        maxLevel: entry.max_level,
        isActive: entry.is_active,
      })),
      rounds,
      completedRoundSlugs,
    });
  } catch (error) {
    return jsonError("Unexpected error while loading contradiction rounds", {
      status: 500,
      code: "MISSIONS_ROUNDS_UNEXPECTED",
      details: {
        reason: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}
