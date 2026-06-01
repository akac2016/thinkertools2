import "server-only";

import { requireActorIdFromRequest } from "@/lib/auth/actor";
import { jsonError, jsonSuccess } from "@/lib/http";
import { type TrainingRow } from "@/lib/quests";
import { filterCapOrderTrainings } from "@/lib/quests/trainings-query";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const actor = await requireActorIdFromRequest(request);
    if (!actor.ok) {
      return actor.response;
    }

    const trainingsResult = await supabaseAdmin
      .from("trainings")
      .select("id,slug,title,max_level,is_active,created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(200)
      .returns<Pick<TrainingRow, "id" | "slug" | "title" | "max_level" | "is_active" | "created_at">[]>();

    if (trainingsResult.error) {
      return jsonError("Failed to load trainings", {
        status: 500,
        code: "MISSIONS_TRAININGS_LOAD_FAILED",
        details: {
          dbCode: trainingsResult.error.code ?? null,
          dbMessage: trainingsResult.error.message,
        },
      });
    }

    const trainings = filterCapOrderTrainings(trainingsResult.data ?? []);

    return jsonSuccess({ trainings });
  } catch (error) {
    return jsonError("Failed to load trainings", {
      status: 500,
      code: "MISSIONS_TRAININGS_LOAD_FAILED",
      details: {
        reason: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}
