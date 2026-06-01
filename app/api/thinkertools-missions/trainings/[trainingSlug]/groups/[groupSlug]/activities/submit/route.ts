import "server-only";

import { z } from "zod";

import { parseBody } from "@/lib/api/route-utils";
import { requireActorIdFromRequest } from "@/lib/auth/actor";
import { jsonError, jsonSuccess } from "@/lib/http";
import {
  TRAINING_ACTIVITY_CONTENT_TYPE,
  RECOVERABLE_INVALID_INPUT_MESSAGE,
  applyEarnedXp,
  computeCompletionRewardXp,
  extractCorrectAnswerLabels,
  extractExpectedAnswerCount,
  extractExplanation,
  extractPromptClaims,
  extractQuestionText,
  extractRoundTypeTag,
  getXpRequiredForNextLevel,
  isMatchingLabelPair,
  matchConstrainedTypedInput,
  normalizeLabelSelection,
  type TrainingActivityRow,
} from "@/lib/quests";
import {
  getActiveTrainingBySlug,
  getOrCreateUserTrainingProgress,
} from "@/lib/quests/server-progress";
import { supabaseAdmin } from "@/lib/supabase/admin";

const submitRoundSchema = z.object({
  activitySlug: z.string().trim().min(1).max(160),
  selectedLabels: z.array(z.string().trim().min(1).max(16)).max(2).optional(),
  typedAnswer: z.string().max(120).optional(),
});

const ACTIVITY_SELECT = [
  "id",
  "slug",
  "title",
  "xp_reward",
  "recommended_level_min",
  "recommended_level_max",
  "round_content",
].join(",");

type RouteContext = {
  params: Promise<{ trainingSlug: string; groupSlug: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { trainingSlug, groupSlug } = await context.params;

    const actor = await requireActorIdFromRequest(request);
    if (!actor.ok) {
      return actor.response;
    }

    const parsedBody = await parseBody(request, submitRoundSchema);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    // Resolve the training from the [trainingSlug] path segment (NOT hardcoded)
    const training = await getActiveTrainingBySlug(trainingSlug);
    if (!training.ok) {
      return training.response;
    }

    // Resolve the group from [groupSlug] within the training
    const groupResult = await supabaseAdmin
      .from("training_activity_groups")
      .select("id")
      .eq("slug", groupSlug)
      .eq("training_id", training.data.id)
      .eq("is_active", true)
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

    // Load the activity scoped to the resolved group
    const activityResult = await supabaseAdmin
      .from("training_activities")
      .select(ACTIVITY_SELECT)
      .eq("slug", parsedBody.data.activitySlug)
      .eq("primary_training_id", training.data.id)
      .eq("activity_group_id", groupResult.data.id)
      .eq("content_type", TRAINING_ACTIVITY_CONTENT_TYPE)
      .eq("is_active", true)
      .maybeSingle();

    if (activityResult.error) {
      return jsonError("Failed to load contradiction round", {
        status: 500,
        code: "MISSIONS_ACTIVITY_LOAD_FAILED",
        details: {
          dbCode: activityResult.error.code ?? null,
          dbMessage: activityResult.error.message,
        },
      });
    }

    const activityData = activityResult.data as Pick<TrainingActivityRow,
      | "id"
      | "slug"
      | "title"
      | "xp_reward"
      | "recommended_level_min"
      | "recommended_level_max"
      | "round_content"
    > | null;

    if (!activityData) {
      return jsonError("Contradiction round not found", {
        status: 404,
        code: "MISSIONS_ACTIVITY_NOT_FOUND",
      });
    }

    const promptClaims = extractPromptClaims(activityData.round_content);
    const visibleLabels = promptClaims.map((claim) => claim.label);
    const correctAnswerLabels = extractCorrectAnswerLabels(activityData.round_content);
    const expectedCount = extractExpectedAnswerCount(activityData.round_content);

    if (visibleLabels.length < expectedCount || correctAnswerLabels.length !== expectedCount) {
      return jsonError("Contradiction round is misconfigured", {
        status: 500,
        code: "MISSIONS_ACTIVITY_CONFIG_INVALID",
      });
    }

    const clickSelection = normalizeLabelSelection(parsedBody.data.selectedLabels ?? []);
    const typedAnswer = (parsedBody.data.typedAnswer ?? "").trim();

    // If the caller submitted a label selection with the wrong count, reject early.
    if (
      parsedBody.data.selectedLabels !== undefined
      && parsedBody.data.selectedLabels.length > 0
      && parsedBody.data.selectedLabels.length !== expectedCount
    ) {
      return jsonError(RECOVERABLE_INVALID_INPUT_MESSAGE, {
        status: 422,
        code: "MISSIONS_SELECTION_REQUIRED",
        details: {
          reason: "wrong_selection_count",
          recoverable: true,
        },
      });
    }

    let resolvedSelection: string[] | null = null;
    let inputMode: "click" | "typed" = "click";
    let matcherMetadata:
      | {
          normalizedInput: string;
          canonicalAnswer: string;
        }
      | null = null;

    const clickSelectionIsValid = clickSelection.length === expectedCount
      && clickSelection.every((label) => visibleLabels.includes(label));

    if (clickSelectionIsValid) {
      resolvedSelection = clickSelection;
      inputMode = "click";
    } else if (typedAnswer) {
      const typedMatch = matchConstrainedTypedInput(typedAnswer, {
        visibleOptionLabels: visibleLabels,
        expectedSelectionCount: expectedCount,
      });

      if (typedMatch.status === "invalid_input") {
        return jsonError(typedMatch.recoverableMessage, {
          status: 422,
          code: "MISSIONS_INVALID_TYPED_SELECTION",
          details: {
            reason: typedMatch.reason,
            normalizedInput: typedMatch.normalizedInput,
            recoverable: true,
          },
        });
      }

      resolvedSelection = normalizeLabelSelection(typedMatch.selectedLabels);
      inputMode = "typed";
      matcherMetadata = {
        normalizedInput: typedMatch.normalizedInput,
        canonicalAnswer: typedMatch.canonicalAnswer,
      };
    } else {
      return jsonError(RECOVERABLE_INVALID_INPUT_MESSAGE, {
        status: 422,
        code: "MISSIONS_SELECTION_REQUIRED",
        details: {
          reason: clickSelection.length > 0 ? "wrong_selection_count" : "empty_input",
          recoverable: true,
        },
      });
    }

    if (!resolvedSelection || resolvedSelection.length !== expectedCount) {
      return jsonError(RECOVERABLE_INVALID_INPUT_MESSAGE, {
        status: 422,
        code: "MISSIONS_SELECTION_REQUIRED",
        details: {
          reason: "wrong_selection_count",
          recoverable: true,
        },
      });
    }

    const wasCorrect = isMatchingLabelPair(resolvedSelection, correctAnswerLabels);

    const progress = await getOrCreateUserTrainingProgress({
      userId: actor.actorId,
      trainingId: training.data.id,
    });

    if (!progress.ok) {
      return progress.response;
    }

    const currentProgress = {
      currentLevel: progress.data.current_level,
      currentLevelXp: progress.data.current_level_xp,
      totalXp: progress.data.total_xp,
    };

    let awardedXp = 0;
    let xpMultiplier: 1 | 0.5 | 0 = 0;

    if (wasCorrect) {
      const reward = computeCompletionRewardXp({
        contentType: TRAINING_ACTIVITY_CONTENT_TYPE,
        baseXp: activityData.xp_reward,
        userLevel: progress.data.current_level,
        recommendedLevelMin: activityData.recommended_level_min,
        recommendedLevelMax: activityData.recommended_level_max,
      });

      awardedXp = reward.awardedXp;
      xpMultiplier = reward.multiplier;
    }

    const updatedProgress = awardedXp > 0
      ? applyEarnedXp(currentProgress, awardedXp)
      : currentProgress;

    if (awardedXp > 0) {
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

    const completionMetadata: Record<string, unknown> = {
      input_mode: inputMode,
      selected_labels: resolvedSelection,
      correct_answer_labels: correctAnswerLabels,
      typed_answer: typedAnswer || null,
      matcher_normalized_input: matcherMetadata?.normalizedInput ?? null,
      matcher_canonical_answer: matcherMetadata?.canonicalAnswer ?? null,
      question_text: extractQuestionText(activityData.round_content),
      round_type: extractRoundTypeTag(activityData.round_content),
      was_correct: wasCorrect,
      xp_multiplier: xpMultiplier,
    };

    const completionResult = await supabaseAdmin
      .from("training_activity_attempts")
      .insert({
        user_id: actor.actorId,
        training_id: training.data.id,
        training_activity_id: activityData.id,
        content_type: TRAINING_ACTIVITY_CONTENT_TYPE,
        was_successful: wasCorrect,
        awarded_xp: awardedXp,
        completion_metadata: completionMetadata,
      });

    if (completionResult.error) {
      return jsonError("Failed to record contradiction round completion", {
        status: 500,
        code: "MISSIONS_COMPLETION_RECORD_FAILED",
        details: {
          dbCode: completionResult.error.code ?? null,
          dbMessage: completionResult.error.message,
        },
      });
    }

    const xpRequiredForNextLevel = getXpRequiredForNextLevel(updatedProgress.currentLevel);

    return jsonSuccess({
      activity: {
        slug: activityData.slug,
        title: activityData.title,
      },
      result: {
        wasCorrect,
        selectedLabels: resolvedSelection,
        correctAnswerLabels,
        explanation: extractExplanation(activityData.round_content),
        awardedXp,
        xpMultiplier,
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
    });
  } catch (error) {
    return jsonError("Unexpected error while submitting contradiction round", {
      status: 500,
      code: "MISSIONS_SUBMIT_UNEXPECTED",
      details: {
        reason: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}
