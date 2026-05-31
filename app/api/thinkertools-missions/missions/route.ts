import "server-only";

import { requireActorIdFromRequest } from "@/lib/auth/actor";
import { jsonError, jsonSuccess } from "@/lib/http";
import { wrongRecruitMission } from "@/lib/missions";
import { upsertMissionCatalogEntry } from "@/lib/missions/server";
import { getXpRequiredForNextLevel, type MissionCompletionRow } from "@/lib/quests";
import {
  getActiveTrainingBySlug,
  getOrCreateUserTrainingProgress,
} from "@/lib/quests/server-progress";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

export async function GET(request: Request) {
  try {
    const actor = await requireActorIdFromRequest(request);
    if (!actor.ok) {
      return actor.response;
    }

    const training = await getActiveTrainingBySlug(wrongRecruitMission.trainingSlug);
    if (!training.ok) {
      return training.response;
    }

    const mission = await upsertMissionCatalogEntry({
      definition: wrongRecruitMission,
      trainingId: training.data.id,
    });
    if (!mission.ok) {
      return mission.response;
    }

    const progress = await getOrCreateUserTrainingProgress({
      userId: actor.actorId,
      trainingId: training.data.id,
    });
    if (!progress.ok) {
      return progress.response;
    }

    const completionResult = await supabaseAdmin
      .from("mission_completions")
      .select(COMPLETION_SELECT)
      .eq("user_id", actor.actorId)
      .eq("mission_id", mission.data.id)
      .maybeSingle();

    if (completionResult.error) {
      return jsonError("Failed to load mission completion", {
        status: 500,
        code: "MISSIONS_COMPLETION_LOAD_FAILED",
        details: {
          dbCode: completionResult.error.code ?? null,
          dbMessage: completionResult.error.message,
        },
      });
    }

    const completion = completionResult.data as Pick<MissionCompletionRow,
      | "id"
      | "user_id"
      | "training_id"
      | "mission_id"
      | "content_type"
      | "awarded_xp"
      | "completion_metadata"
      | "completed_at"
    > | null;
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
      missions: [{
        id: mission.data.id,
        slug: mission.data.slug,
        title: mission.data.title,
        xpReward: mission.data.xp_reward,
        isActive: mission.data.is_active,
        isCompleted: Boolean(completion),
        completedAt: completion?.completed_at ?? null,
        awardedXp: completion?.awarded_xp ?? 0,
        replayCount: getReplayCount(completion?.completion_metadata),
        canReplay: true,
      }],
    });
  } catch (error) {
    return jsonError("Unexpected error while loading missions", {
      status: 500,
      code: "MISSIONS_LOAD_UNEXPECTED",
      details: {
        reason: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}
