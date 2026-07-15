import "server-only";

import { z } from "zod";

import { parseWithSchema, unexpectedError } from "@/lib/api/route-utils";
import { requireActorIdFromRequest } from "@/lib/auth/actor";
import { deriveActivityAuthoringState } from "@/lib/authoring/activity-authoring-state";
import { missionBodySchema } from "@/lib/authoring/mission-schema";
import { getDraftById, updateDraft } from "@/lib/authoring/server";
import { validateDraft } from "@/lib/authoring/validation";
import { jsonError, jsonSuccess } from "@/lib/http";
import { ACTIVE_MISSION_CONTENT_TYPE } from "@/lib/quests";
import { supabaseAdmin } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ draftId: string }>;
};

const draftParamsSchema = z.object({
  draftId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Slug generation
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function generateUniqueSlug(
  baseSlug: string,
): Promise<string | null> {
  const candidates = [baseSlug];
  for (let i = 2; i <= 10; i++) {
    candidates.push(`${baseSlug}-${i}`);
  }

  for (const candidate of candidates) {
    const { data, error } = await supabaseAdmin
      .from("training_activities")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();

    if (error) throw new Error(`Slug check failed: ${error.message}`);
    if (!data) {
      // No row with this slug — it's available
      return candidate;
    }
  }

  return null; // All 10 candidates collided
}

async function generateUniqueMissionSlug(
  baseSlug: string,
): Promise<string | null> {
  const candidates = [baseSlug];
  for (let i = 2; i <= 10; i++) {
    candidates.push(`${baseSlug}-${i}`);
  }

  for (const candidate of candidates) {
    const { data, error } = await supabaseAdmin
      .from("missions")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();

    if (error) throw new Error(`Mission slug check failed: ${error.message}`);
    if (!data) {
      return candidate;
    }
  }

  return null; // All 10 candidates collided
}

// ---------------------------------------------------------------------------
// POST /api/thinkertools-missions-create/drafts/[draftId]/publish
// ---------------------------------------------------------------------------

export async function POST(request: Request, context: RouteContext) {
  try {
    // --- Auth ---
    const actor = await requireActorIdFromRequest(request);
    if (!actor.ok) {
      return actor.response;
    }

    // --- Params ---
    const rawParams = await context.params;
    const parsedParams = parseWithSchema(rawParams, draftParamsSchema, "params");
    if (!parsedParams.ok) {
      return parsedParams.response;
    }

    const { draftId } = parsedParams.data;

    // --- Load draft + ownership check ---
    const draft = await getDraftById(draftId);
    if (!draft) {
      return jsonError("Draft not found", {
        status: 404,
        code: "AUTHORING_DRAFT_NOT_FOUND",
      });
    }

    if (draft.createdBy !== actor.actorId) {
      return jsonError("You do not have permission to access this draft", {
        status: 403,
        code: "AUTHORING_DRAFT_FORBIDDEN",
      });
    }

    const activityAuthoringState = deriveActivityAuthoringState({
      subjectTrainingId: draft.primaryTrainingId,
      selectedContentType: draft.contentType,
      hasDraft: true,
      activityGroupId: draft.activityGroupId,
      draftStatus: draft.status,
    });

    if (draft.contentType === "activity" && activityAuthoringState.needsActivityGroup) {
      return jsonError("Assign this draft to an activity group before publishing.", {
        status: 409,
        code: "AUTHORING_ACTIVITY_GROUP_REQUIRED",
      });
    }

    // --- Require status === 'valid' ---
    if (draft.status !== "valid") {
      return jsonError(
        "Draft must pass validation before it can be published.",
        {
          status: 409,
          code: "AUTHORING_PUBLISH_NOT_VALID",
          details: { validationIssues: draft.validationIssues },
        },
      );
    }

    // --- Re-validate to catch any drift ---
    const freshIssues = validateDraft(draft.contentType, draft.body);
    if (freshIssues.length > 0) {
      // Persist the updated issues and demote status back to draft
      await updateDraft(draftId, {
        status: "draft",
        validationIssues: freshIssues,
      });
      return jsonError(
        "Draft failed re-validation and has been returned to draft status.",
        {
          status: 409,
          code: "AUTHORING_PUBLISH_NOT_VALID",
          details: { validationIssues: freshIssues },
        },
      );
    }

    // --- Generate a unique slug ---
    const rawTitle = draft.title?.trim() ?? "";

    if (draft.contentType === "mission") {
      // ── Mission publish path ──────────────────────────────────────────────

      // Parse the body with missionBodySchema
      const bodyParsed = missionBodySchema.safeParse(draft.body);
      if (!bodyParsed.success) {
        return jsonError("Draft body is not a valid mission body.", {
          status: 409,
          code: "AUTHORING_PUBLISH_NOT_VALID",
          details: { validationIssues: bodyParsed.error.issues },
        });
      }
      const missionBody = bodyParsed.data;

      const missionBaseSlug = rawTitle
        ? slugify(rawTitle)
        : `mission-${draftId.slice(0, 8)}`;
      const finalMissionBaseSlug = missionBaseSlug || `mission-${draftId.slice(0, 8)}`;

      const missionSlug = await generateUniqueMissionSlug(finalMissionBaseSlug);
      if (!missionSlug) {
        return jsonError(
          "Could not generate a unique slug for this mission. Please rename the title and try again.",
          {
            status: 409,
            code: "AUTHORING_SLUG_CONFLICT",
          },
        );
      }

      // Upsert into missions table
      const { data: upsertedMission, error: upsertError } = await supabaseAdmin
        .from("missions")
        .upsert(
          {
            slug: missionSlug,
            title: draft.title || "Untitled Mission",
            primary_training_id: draft.primaryTrainingId,
            content_type: ACTIVE_MISSION_CONTENT_TYPE,
            publication_status: "pending",
            mission_body: draft.body,
            narrative_hook: missionBody.narrative_hook,
            short_description: missionBody.short_description,
            difficulty_label: missionBody.difficulty_label,
            required_training_level: missionBody.required_training_level,
            xp_reward: missionBody.xp_reward,
            completion_criteria: "",
            rewards_metadata: {},
            updated_at: new Date().toISOString(),
          },
          { onConflict: "slug" },
        )
        .select("id, slug")
        .single();

      if (upsertError) {
        throw new Error(`Failed to upsert mission: ${upsertError.message}`);
      }

      const publishedMission = upsertedMission as { id: string; slug: string };

      // Update draft to published
      const updatedDraftMission = await updateDraft(draftId, {
        status: "published",
        publishedRefId: publishedMission.id,
        slug: missionSlug,
      });

      return jsonSuccess(
        {
          draft: updatedDraftMission,
          publishedMission: {
            id: publishedMission.id,
            slug: publishedMission.slug,
          },
        },
        { status: 200 },
      );
    }

    // ── Activity publish path ─────────────────────────────────────────────────

    const baseSlug = rawTitle
      ? slugify(rawTitle)
      : `activity-${draftId.slice(0, 8)}`;
    const finalBaseSlug = baseSlug || `activity-${draftId.slice(0, 8)}`;

    const slug = await generateUniqueSlug(finalBaseSlug);
    if (!slug) {
      return jsonError(
        "Could not generate a unique slug for this activity. Please rename the title and try again.",
        {
          status: 409,
          code: "AUTHORING_SLUG_CONFLICT",
        },
      );
    }

    // --- Insert into training_activities ---
    const { data: insertedRow, error: insertError } = await supabaseAdmin
      .from("training_activities")
      .insert({
        slug,
        title: draft.title || "Untitled Activity",
        primary_training_id: draft.primaryTrainingId,
        activity_group_id: draft.activityGroupId,
        content_type: "activity",
        template_family: "contradiction_belief_set_incompatible_pair",
        publication_status: "pending",
        round_content: draft.body,
        xp_reward: 20,
        recommended_level_min: 1,
        recommended_level_max: 5,
        short_description: "",
        difficulty_label: "standard",
      })
      .select("id, slug")
      .single();

    if (insertError) {
      throw new Error(`Failed to insert training activity: ${insertError.message}`);
    }

    const publishedActivity = insertedRow as { id: string; slug: string };

    // --- Update draft to published ---
    const updatedDraft = await updateDraft(draftId, {
      status: "published",
      publishedRefId: publishedActivity.id,
      slug,
    });

    return jsonSuccess(
      {
        draft: updatedDraft,
        publishedActivity: {
          id: publishedActivity.id,
          slug: publishedActivity.slug,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return unexpectedError("Failed to publish draft", error);
  }
}
