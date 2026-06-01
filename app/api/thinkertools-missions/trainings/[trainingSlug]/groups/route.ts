import "server-only";

import { requireActorIdFromRequest } from "@/lib/auth/actor";
import { jsonError, jsonSuccess } from "@/lib/http";
import { getActiveTrainingBySlug } from "@/lib/quests/server-progress";
import { filterOrderActivityGroups, type RawActivityGroupRow } from "@/lib/quests/activity-groups-query";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ trainingSlug: string }> },
) {
  try {
    const actor = await requireActorIdFromRequest(request);
    if (!actor.ok) {
      return actor.response;
    }

    const { trainingSlug } = await params;

    const training = await getActiveTrainingBySlug(trainingSlug);
    if (!training.ok) {
      return training.response;
    }

    const groupsResult = await supabaseAdmin
      .from("training_activity_groups")
      .select("id,slug,title,description,training_id,display_order,is_active")
      .eq("training_id", training.data.id)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("slug", { ascending: true })
      .returns<RawActivityGroupRow[]>();

    if (groupsResult.error) {
      return jsonError("Failed to load activity groups", {
        status: 500,
        code: "MISSIONS_ACTIVITY_GROUPS_LOAD_FAILED",
        details: {
          dbCode: groupsResult.error.code ?? null,
          dbMessage: groupsResult.error.message,
        },
      });
    }

    const groups = filterOrderActivityGroups(
      groupsResult.data ?? [],
      training.data.id,
    );

    return jsonSuccess({ groups });
  } catch (error) {
    return jsonError("Failed to load activity groups", {
      status: 500,
      code: "MISSIONS_ACTIVITY_GROUPS_LOAD_FAILED",
      details: {
        reason: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}
