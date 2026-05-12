import "server-only";

import { jsonError, jsonSuccess } from "@/lib/http";
import { requireActorIdFromRequest } from "@/lib/auth/actor";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  TRAINING_ACTIVITY_CONTENT_TYPE,
  QUESTS_ACTIVE_SKILL_SLUG,
  extractPromptClaims,
  extractQuestionText,
  extractRoundTypeTag,
  getXpRequiredForNextLevel,
  type TrainingActivityRow,
  type QuestsSkillRow,
} from "@/lib/quests";
import { getActiveSkillBySlug, getOrCreateUserSkillProgress } from "@/lib/quests/server-progress";

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

    const skill = await getActiveSkillBySlug(QUESTS_ACTIVE_SKILL_SLUG);
    if (!skill.ok) {
      return skill.response;
    }

    const progress = await getOrCreateUserSkillProgress({
      userId: actor.actorId,
      skillId: skill.data.id,
    });

    if (!progress.ok) {
      return progress.response;
    }

    const skillsResult = await supabaseAdmin
      .from("quests_skills")
      .select("id,slug,title,max_level,is_active")
      .order("created_at", { ascending: true })
      .returns<Pick<QuestsSkillRow, "id" | "slug" | "title" | "max_level" | "is_active">[]>();

    if (skillsResult.error) {
      return jsonError("Failed to load skill catalog", {
        status: 500,
        code: "QUESTS_SKILL_CATALOG_LOAD_FAILED",
        details: {
          dbCode: skillsResult.error.code ?? null,
          dbMessage: skillsResult.error.message,
        },
      });
    }

    const activitiesResult = await supabaseAdmin
      .from("training_activities")
      .select(ACTIVITY_SELECT)
      .eq("primary_skill_id", skill.data.id)
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
        code: "QUESTS_ACTIVITY_LOAD_FAILED",
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
    }));

    const xpRequiredForNextLevel = getXpRequiredForNextLevel(progress.data.current_level);

    return jsonSuccess({
      skill: {
        id: skill.data.id,
        slug: skill.data.slug,
        title: skill.data.title,
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
      skillCatalog: (skillsResult.data ?? []).map((entry) => ({
        id: entry.id,
        slug: entry.slug,
        title: entry.title,
        maxLevel: entry.max_level,
        isActive: entry.is_active,
      })),
      rounds,
    });
  } catch (error) {
    return jsonError("Unexpected error while loading contradiction rounds", {
      status: 500,
      code: "QUESTS_ROUNDS_UNEXPECTED",
      details: {
        reason: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}
