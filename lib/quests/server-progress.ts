import "server-only";

import { jsonError } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";

import type { TrainingRow, UserTrainingProgressRow } from "./domain-types.ts";

const TRAINING_SELECT = "id,slug,title";
const PROGRESS_SELECT = "id,user_id,training_id,current_level,current_level_xp,total_xp";

export async function getActiveTrainingBySlug(trainingSlug: string) {
  const trainingResult = await supabaseAdmin
    .from("trainings")
    .select(TRAINING_SELECT)
    .eq("slug", trainingSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (trainingResult.error) {
    return {
      ok: false as const,
      response: jsonError("Failed to load active training", {
        status: 500,
        code: "MISSIONS_TRAINING_LOAD_FAILED",
        details: {
          dbCode: trainingResult.error.code ?? null,
          dbMessage: trainingResult.error.message,
        },
      }),
    };
  }

  const trainingData = trainingResult.data as Pick<TrainingRow, "id" | "slug" | "title"> | null;

  if (!trainingData) {
    return {
      ok: false as const,
      response: jsonError("Active training is not configured", {
        status: 404,
        code: "MISSIONS_TRAINING_NOT_FOUND",
      }),
    };
  }

  return {
    ok: true as const,
    data: trainingData,
  };
}

export async function getOrCreateUserTrainingProgress(input: { userId: string; trainingId: string }) {
  const existing = await supabaseAdmin
    .from("user_training_progress")
    .select(PROGRESS_SELECT)
    .eq("user_id", input.userId)
    .eq("training_id", input.trainingId)
    .maybeSingle();

  if (existing.error) {
    return {
      ok: false as const,
      response: jsonError("Failed to load user training progress", {
        status: 500,
        code: "MISSIONS_PROGRESS_LOAD_FAILED",
        details: {
          dbCode: existing.error.code ?? null,
          dbMessage: existing.error.message,
        },
      }),
    };
  }

  const existingData = existing.data as Pick<UserTrainingProgressRow,
    | "id"
    | "user_id"
    | "training_id"
    | "current_level"
    | "current_level_xp"
    | "total_xp"
  > | null;

  if (existingData) {
    return {
      ok: true as const,
      data: existingData,
    };
  }

  const inserted = await supabaseAdmin
    .from("user_training_progress")
    .insert({
      user_id: input.userId,
      training_id: input.trainingId,
      current_level: 1,
      current_level_xp: 0,
      total_xp: 0,
    })
    .select(PROGRESS_SELECT)
    .single();

  if (inserted.error) {
    return {
      ok: false as const,
      response: jsonError("Failed to initialize user training progress", {
        status: 500,
        code: "MISSIONS_PROGRESS_INIT_FAILED",
        details: {
          dbCode: inserted.error.code ?? null,
          dbMessage: inserted.error.message,
        },
      }),
    };
  }

  return {
    ok: true as const,
    data: inserted.data as Pick<UserTrainingProgressRow,
      | "id"
      | "user_id"
      | "training_id"
      | "current_level"
      | "current_level_xp"
      | "total_xp"
    >,
  };
}
