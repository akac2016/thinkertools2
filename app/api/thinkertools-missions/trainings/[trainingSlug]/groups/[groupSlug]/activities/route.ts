import "server-only";

import { requireActorIdFromRequest } from "@/lib/auth/actor";
import { jsonError, jsonSuccess } from "@/lib/http";
import {
  TRAINING_ACTIVITY_CONTENT_TYPE,
  extractExpectedAnswerCount,
  extractPromptClaims,
  extractQuestionText,
  extractRoundTypeTag,
  getXpRequiredForNextLevel,
  type TrainingActivityRow,
} from "@/lib/quests";
import {
  getActiveTrainingBySlug,
  getOrCreateUserTrainingProgress,
} from "@/lib/quests/server-progress";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ trainingSlug: string; groupSlug: string }> },
) {
  try {
    const actor = await requireActorIdFromRequest(request);
    if (!actor.ok) {
      return actor.response;
    }

    const { trainingSlug, groupSlug } = await params;

    // 1. Resolve the active training by slug
    const training = await getActiveTrainingBySlug(trainingSlug);
    if (!training.ok) {
      return training.response;
    }

    // 2. Resolve the active group by slug within this training
    const groupResult = await supabaseAdmin
      .from("training_activity_groups")
      .select("id,slug,training_id,publication_status")
      .eq("slug", groupSlug)
      .eq("training_id", training.data.id)
      .eq("publication_status", "live")
      .maybeSingle();

    if (groupResult.error) {
      return jsonError("Failed to load activity group", {
        status: 500,
        code: "MISSIONS_ACTIVITY_GROUP_LOAD_FAILED",
        details: {
          dbCode: groupResult.error.code ?? null,
          dbMessage: groupResult.error.message,
        },
      });
    }

    if (!groupResult.data) {
      return jsonError("Activity group not found", {
        status: 404,
        code: "MISSIONS_ACTIVITY_GROUP_NOT_FOUND",
      });
    }

    // 3. Initialize/resolve progress for the training
    const progress = await getOrCreateUserTrainingProgress({
      userId: actor.actorId,
      trainingId: training.data.id,
    });

    if (!progress.ok) {
      return progress.response;
    }

    // 4. Query activities scoped to this group
    const activitiesResult = await supabaseAdmin
      .from("training_activities")
      .select(ACTIVITY_SELECT)
      .eq("activity_group_id", groupResult.data.id)
      .eq("content_type", TRAINING_ACTIVITY_CONTENT_TYPE)
      .eq("publication_status", "live")
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
      return jsonError("Failed to load activities", {
        status: 500,
        code: "MISSIONS_ACTIVITY_LOAD_FAILED",
        details: {
          dbCode: activitiesResult.error.code ?? null,
          dbMessage: activitiesResult.error.message,
        },
      });
    }

    // 5. Extract rounds (same logic as the legacy route)
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

    // 6. Resolve completed round slugs
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
        return jsonError("Failed to load completed rounds", {
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

    // Return the same shape as the legacy route minus trainingCatalog
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
      rounds,
      completedRoundSlugs,
    });
  } catch (error) {
    return jsonError("Unexpected error while loading activities", {
      status: 500,
      code: "MISSIONS_ROUNDS_UNEXPECTED",
      details: {
        reason: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}
