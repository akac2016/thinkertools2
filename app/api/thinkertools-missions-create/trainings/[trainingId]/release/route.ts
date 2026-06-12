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

// POST /api/thinkertools-missions-create/trainings/[trainingId]/release
// Flips a pending training to 'live', making it visible to players.
export async function POST(request: Request, context: RouteContext) {
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

    // --- Fetch training ---
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

    // --- Check current publication_status ---
    if (training.publication_status === "live") {
      // Already live — idempotent success
      return jsonSuccess(
        {
          message: "Training is already live.",
          trainingId: training.id,
        },
        { status: 200 },
      );
    }

    if (training.publication_status === "archived") {
      return jsonError(
        "Cannot release archived training. Restore it first.",
        {
          status: 409,
          code: "TRAINING_RELEASE_ARCHIVED",
        },
      );
    }

    // --- Flip publication_status to 'live' ---
    const { error: updateError } = await supabaseAdmin
      .from("trainings")
      .update({ 
        publication_status: "live", 
        updated_at: new Date().toISOString() 
      })
      .eq("id", trainingId);

    if (updateError) {
      throw new Error(`Failed to update publication status: ${updateError.message}`);
    }

    return jsonSuccess(
      {
        message: "Training is now live.",
        trainingId: training.id,
      },
      { status: 200 },
    );
  } catch (error) {
    return unexpectedError("Failed to release training", error);
  }
}
