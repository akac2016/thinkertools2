import "server-only";

import { jsonError } from "@/lib/http";
import { ACTIVE_MISSION_CONTENT_TYPE, type MissionRow } from "@/lib/quests";
import { supabaseAdmin } from "@/lib/supabase/admin";

import type { MissionDefinition } from "./domain-types";

const MISSION_SELECT = [
  "id",
  "slug",
  "title",
  "primary_training_id",
  "content_type",
  "narrative_hook",
  "short_description",
  "difficulty_label",
  "required_training_level",
  "completion_criteria",
  "xp_reward",
  "rewards_metadata",
  "is_active",
].join(",");

export type MissionCatalogRow = Pick<MissionRow,
  | "id"
  | "slug"
  | "title"
  | "primary_training_id"
  | "content_type"
  | "narrative_hook"
  | "short_description"
  | "difficulty_label"
  | "required_training_level"
  | "completion_criteria"
  | "xp_reward"
  | "rewards_metadata"
  | "is_active"
>;

type MissionCatalogResult =
  | {
      ok: true;
      data: MissionCatalogRow;
    }
  | {
      ok: false;
      response: ReturnType<typeof jsonError>;
    };

export async function upsertMissionCatalogEntry(input: {
  definition: MissionDefinition;
  trainingId: string;
}): Promise<MissionCatalogResult> {
  const missionResult = await supabaseAdmin
    .from("missions")
    .upsert({
      slug: input.definition.slug,
      title: input.definition.title,
      primary_training_id: input.trainingId,
      content_type: ACTIVE_MISSION_CONTENT_TYPE,
      narrative_hook: input.definition.narrativeHook,
      short_description: input.definition.shortDescription,
      difficulty_label: input.definition.difficultyLabel,
      required_training_level: input.definition.requiredTrainingLevel,
      completion_criteria: input.definition.completionCriteria,
      xp_reward: input.definition.xpReward,
      rewards_metadata: {
        mission_type: input.definition.missionType,
        next_recommended_activity_slug: input.definition.nextRecommendedActivitySlug,
        source_title: input.definition.source.title,
      },
      is_active: true,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "slug",
    })
    .select(MISSION_SELECT)
    .returns<MissionCatalogRow>()
    .single();

  if (missionResult.error) {
    return {
      ok: false as const,
      response: jsonError("Failed to sync mission catalog entry", {
        status: 500,
        code: "MISSIONS_CATALOG_SYNC_FAILED",
        details: {
          dbCode: missionResult.error.code ?? null,
          dbMessage: missionResult.error.message,
        },
      }),
    };
  }

  return {
    ok: true as const,
    data: missionResult.data as MissionCatalogRow,
  };
}

// ── Data-driven mission loader ────────────────────────────────────────────────

export type ActiveMissionRow = {
  id: string;
  slug: string;
  title: string;
  xp_reward: number;
  primary_training_id: string;
  rewards_metadata: Record<string, unknown> | null;
  mission_body: unknown;
};

/**
 * Load an active mission row (including its stored `mission_body`) by slug.
 * Returns null when no active mission with that slug exists.
 */
export async function loadActiveMissionBySlug(
  slug: string,
): Promise<ActiveMissionRow | null> {
  const result = await supabaseAdmin
    .from("missions")
    .select("id, slug, title, xp_reward, primary_training_id, rewards_metadata, mission_body")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (result.error) {
    // Surface the error as null so callers can return a 404; the caller is
    // responsible for deciding whether to surface a 500 or a 404.
    return null;
  }

  return result.data as ActiveMissionRow | null;
}
