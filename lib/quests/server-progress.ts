import "server-only";

import { jsonError } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";

import type { QuestsSkillRow, QuestsUserSkillProgressRow } from "./domain-types.ts";

const SKILL_SELECT = "id,slug,title";
const PROGRESS_SELECT = "id,user_id,skill_id,current_level,current_level_xp,total_xp";

export async function getActiveSkillBySlug(skillSlug: string) {
  const skillResult = await supabaseAdmin
    .from("quests_skills")
    .select(SKILL_SELECT)
    .eq("slug", skillSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (skillResult.error) {
    return {
      ok: false as const,
      response: jsonError("Failed to load active quest skill", {
        status: 500,
        code: "QUESTS_SKILL_LOAD_FAILED",
        details: {
          dbCode: skillResult.error.code ?? null,
          dbMessage: skillResult.error.message,
        },
      }),
    };
  }

  const skillData = skillResult.data as Pick<QuestsSkillRow, "id" | "slug" | "title"> | null;

  if (!skillData) {
    return {
      ok: false as const,
      response: jsonError("Active quest skill is not configured", {
        status: 404,
        code: "QUESTS_SKILL_NOT_FOUND",
      }),
    };
  }

  return {
    ok: true as const,
    data: skillData,
  };
}

export async function getOrCreateUserSkillProgress(input: { userId: string; skillId: string }) {
  const existing = await supabaseAdmin
    .from("quests_user_skill_progress")
    .select(PROGRESS_SELECT)
    .eq("user_id", input.userId)
    .eq("skill_id", input.skillId)
    .maybeSingle();

  if (existing.error) {
    return {
      ok: false as const,
      response: jsonError("Failed to load user quest progress", {
        status: 500,
        code: "QUESTS_PROGRESS_LOAD_FAILED",
        details: {
          dbCode: existing.error.code ?? null,
          dbMessage: existing.error.message,
        },
      }),
    };
  }

  const existingData = existing.data as Pick<QuestsUserSkillProgressRow,
    | "id"
    | "user_id"
    | "skill_id"
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
    .from("quests_user_skill_progress")
    .insert({
      user_id: input.userId,
      skill_id: input.skillId,
      current_level: 1,
      current_level_xp: 0,
      total_xp: 0,
    })
    .select(PROGRESS_SELECT)
    .single();

  if (inserted.error) {
    return {
      ok: false as const,
      response: jsonError("Failed to initialize user quest progress", {
        status: 500,
        code: "QUESTS_PROGRESS_INIT_FAILED",
        details: {
          dbCode: inserted.error.code ?? null,
          dbMessage: inserted.error.message,
        },
      }),
    };
  }

  return {
    ok: true as const,
    data: inserted.data as Pick<QuestsUserSkillProgressRow,
      | "id"
      | "user_id"
      | "skill_id"
      | "current_level"
      | "current_level_xp"
      | "total_xp"
    >,
  };
}
