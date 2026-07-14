import "server-only";

import { requireActorIdFromRequest } from "@/lib/auth/actor";
import { jsonError, jsonSuccess } from "@/lib/http";
import { ACTIVE_TRAINING_SLUG, getXpRequiredForNextLevel } from "@/lib/quests";
import {
  filterAndOrderActiveMissions,
  mergeMissionsWithCompletions,
  type RawCompletionRow,
  type RawMissionRow,
} from "@/lib/quests/missions-query";
import {
  getActiveTrainingBySlug,
  getOrCreateUserTrainingProgress,
} from "@/lib/quests/server-progress";
import { supabaseAdmin } from "@/lib/supabase/admin";

const MISSION_LIST_SELECT = "id,slug,title,xp_reward,publication_status";
const COMPLETION_LIST_SELECT = "mission_id,awarded_xp,completion_metadata,completed_at";

export async function GET(request: Request) {
  try {
    const actor = await requireActorIdFromRequest(request);
    if (!actor.ok) {
      return actor.response;
    }

    // Load active training for progress payload (kept for backward compat)
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

    // Query all active missions ordered by slug ascending
    const missionsResult = await supabaseAdmin
      .from("missions")
      .select(MISSION_LIST_SELECT)
      .eq("publication_status", "live")
      .order("slug", { ascending: true })
      .returns<RawMissionRow[]>();

    if (missionsResult.error) {
      return jsonError("Failed to load missions", {
        status: 500,
        code: "MISSIONS_LIST_LOAD_FAILED",
        details: {
          dbCode: missionsResult.error.code ?? null,
          dbMessage: missionsResult.error.message,
        },
      });
    }

    const activeMissions = filterAndOrderActiveMissions(missionsResult.data ?? []);

    // Zero active missions → return empty list with progress
    if (activeMissions.length === 0) {
      const xpRequiredForNextLevel = getXpRequiredForNextLevel(progress.data.current_level);
      return jsonSuccess({
        progress: {
          currentLevel: progress.data.current_level,
          currentLevelXp: progress.data.current_level_xp,
          totalXp: progress.data.total_xp,
          xpRequiredForNextLevel,
          xpRemainingForNextLevel: xpRequiredForNextLevel > 0
            ? Math.max(0, xpRequiredForNextLevel - progress.data.current_level_xp)
            : 0,
        },
        missions: [],
      });
    }

    // Load per-user completions for all active missions in a single query
    const missionIds = activeMissions.map((m) => m.id);
    const completionsResult = await supabaseAdmin
      .from("mission_completions")
      .select(COMPLETION_LIST_SELECT)
      .eq("user_id", actor.actorId)
      .in("mission_id", missionIds)
      .returns<RawCompletionRow[]>();

    if (completionsResult.error) {
      return jsonError("Failed to load missions", {
        status: 500,
        code: "MISSIONS_LIST_LOAD_FAILED",
        details: {
          dbCode: completionsResult.error.code ?? null,
          dbMessage: completionsResult.error.message,
        },
      });
    }

    const missions = mergeMissionsWithCompletions(
      activeMissions,
      completionsResult.data ?? [],
    );

    const xpRequiredForNextLevel = getXpRequiredForNextLevel(progress.data.current_level);

    return jsonSuccess({
      progress: {
        currentLevel: progress.data.current_level,
        currentLevelXp: progress.data.current_level_xp,
        totalXp: progress.data.total_xp,
        xpRequiredForNextLevel,
        xpRemainingForNextLevel: xpRequiredForNextLevel > 0
          ? Math.max(0, xpRequiredForNextLevel - progress.data.current_level_xp)
          : 0,
      },
      missions,
    });
  } catch (error) {
    return jsonError("Failed to load missions", {
      status: 500,
      code: "MISSIONS_LIST_LOAD_FAILED",
      details: {
        reason: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}
