import "server-only";

import { z } from "zod";

import { parseWithSchema, unexpectedError } from "@/lib/api/route-utils";
import { requireActorIdFromRequest } from "@/lib/auth/actor";
import { jsonError, jsonSuccess } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ trainingId: string }>;
};

const trainingParamsSchema = z.object({
  trainingId: z.string().uuid(),
});

async function countForTraining(table: string, column: string, trainingId: string) {
  const { count, error } = await supabaseAdmin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, trainingId);

  if (error) {
    throw new Error(`Failed to count ${table}: ${error.message}`);
  }

  return count ?? 0;
}

// DELETE /api/thinkertools-missions-create/trainings/[trainingId]
// Hard-deletes draft-only trainings. Archives trainings that have published content.
export async function DELETE(request: Request, context: RouteContext) {
  try {
    // --- Auth ---
    const actor = await requireActorIdFromRequest(request);
    if (!actor.ok) {
      return actor.response;
    }

    // --- Params ---
    const rawParams = await context.params;
    const parsedParams = parseWithSchema(rawParams, trainingParamsSchema, "params");
    if (!parsedParams.ok) {
      return parsedParams.response;
    }

    const { trainingId } = parsedParams.data;

    // --- Check if training exists ---
    const { data: training, error: fetchError } = await supabaseAdmin
      .from("trainings")
      .select("id, publication_status, title")
      .eq("id", trainingId)
      .maybeSingle();

    if (fetchError) {
      throw new Error(`Failed to fetch training: ${fetchError.message}`);
    }

    if (!training) {
      return jsonError("Training not found", {
        status: 404,
        code: "TRAINING_NOT_FOUND",
      });
    }

    const [
      groupCount,
      activityCount,
      missionCount,
      draftCount,
      attemptCount,
      completionCount,
    ] = await Promise.all([
      countForTraining("training_activity_groups", "training_id", trainingId),
      countForTraining("training_activities", "primary_training_id", trainingId),
      countForTraining("missions", "primary_training_id", trainingId),
      countForTraining("content_drafts", "primary_training_id", trainingId),
      countForTraining("training_activity_attempts", "training_id", trainingId),
      countForTraining("mission_completions", "training_id", trainingId),
    ]);

    const hasPublishedContent =
      groupCount > 0 ||
      activityCount > 0 ||
      missionCount > 0 ||
      attemptCount > 0 ||
      completionCount > 0;
    const hasDrafts = draftCount > 0;

    if (hasPublishedContent) {
      if (training.publication_status === "live") {
        return jsonError(
          "Cannot delete a live training with published content. Archive it first by contacting support.",
          {
            status: 409,
            code: "TRAINING_IS_LIVE",
          },
        );
      }

      if (training.publication_status === "archived") {
        return jsonSuccess({ deleted: true, archived: true }, { status: 200 });
      }

      const { error: updateError } = await supabaseAdmin
        .from("trainings")
        .update({
          publication_status: "archived",
          updated_at: new Date().toISOString(),
        })
        .eq("id", trainingId);

      if (updateError) {
        throw new Error(`Failed to archive training: ${updateError.message}`);
      }

      return jsonSuccess({ deleted: true, archived: true }, { status: 200 });
    }

    if (hasDrafts) {
      const { error: draftDeleteError } = await supabaseAdmin
        .from("content_drafts")
        .delete()
        .eq("primary_training_id", trainingId);

      if (draftDeleteError) {
        throw new Error(`Failed to delete drafts: ${draftDeleteError.message}`);
      }
    }

    const { error: deleteError } = await supabaseAdmin
      .from("trainings")
      .delete()
      .eq("id", trainingId);

    if (deleteError) {
      throw new Error(`Failed to delete training: ${deleteError.message}`);
    }

    return jsonSuccess({ deleted: true, archived: false }, { status: 200 });
  } catch (error) {
    return unexpectedError("Failed to delete training", error);
  }
}
