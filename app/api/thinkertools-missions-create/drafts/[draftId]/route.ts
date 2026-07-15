import "server-only";

import { z } from "zod";

import { parseBody, parseWithSchema, unexpectedError } from "@/lib/api/route-utils";
import { requireActorIdFromRequest } from "@/lib/auth/actor";
import {
  deleteDraft,
  getDraftById,
  updateDraft,
} from "@/lib/authoring/server";
import { buildDraftUpdatePatch } from "@/lib/authoring/draft-update";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { jsonError, jsonSuccess } from "@/lib/http";

type RouteContext = {
  params: Promise<{ draftId: string }>;
};

const draftParamsSchema = z.object({
  draftId: z.string().uuid(),
});

const patchDraftBodySchema = z.object({
  title: z.string().trim().max(300).optional(),
  body: z.record(z.string(), z.unknown()).optional(),
  slug: z.string().trim().min(1).max(200).nullable().optional(),
  activityGroupId: z.string().uuid().nullable().optional(),
});

// Resolve and validate the draftId param, authenticate the actor, and verify
// ownership. Returns the draft and actorId on success, or a Response on failure.
async function resolveAndAuthorize(request: Request, context: RouteContext) {
  const actor = await requireActorIdFromRequest(request);
  if (!actor.ok) {
    return { ok: false as const, response: actor.response };
  }

  const rawParams = await context.params;
  const parsedParams = parseWithSchema(rawParams, draftParamsSchema, "params");
  if (!parsedParams.ok) {
    return { ok: false as const, response: parsedParams.response };
  }

  const { draftId } = parsedParams.data;

  const draft = await getDraftById(draftId);
  if (!draft) {
    return {
      ok: false as const,
      response: jsonError("Draft not found", {
        status: 404,
        code: "AUTHORING_DRAFT_NOT_FOUND",
      }),
    };
  }

  if (draft.createdBy !== actor.actorId) {
    return {
      ok: false as const,
      response: jsonError("You do not have permission to access this draft", {
        status: 403,
        code: "AUTHORING_DRAFT_FORBIDDEN",
      }),
    };
  }

  return { ok: true as const, draft, actorId: actor.actorId };
}

async function enrichDraftMetadata(draft: Awaited<ReturnType<typeof getDraftById>>) {
  if (!draft) return draft;

  const [trainingResult, groupResult, publishedActivityResult] = await Promise.all([
    supabaseAdmin
      .from("trainings")
      .select("title")
      .eq("id", draft.primaryTrainingId)
      .maybeSingle(),
    draft.activityGroupId
      ? supabaseAdmin
          .from("training_activity_groups")
          .select("title")
          .eq("id", draft.activityGroupId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    draft.contentType === "activity" && draft.publishedRefId
      ? supabaseAdmin
          .from("training_activities")
          .select("publication_status")
          .eq("id", draft.publishedRefId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  return {
    ...draft,
    trainingTitle: trainingResult.data?.title ?? null,
    activityGroupTitle: groupResult.data?.title ?? null,
    publishedActivityStatus:
      publishedActivityResult.data?.publication_status === "pending"
      || publishedActivityResult.data?.publication_status === "live"
        ? publishedActivityResult.data.publication_status
        : null,
  };
}

async function deleteActivityGroupIfEmpty(activityGroupId: string): Promise<boolean> {
  const [activityResult, draftResult] = await Promise.all([
    supabaseAdmin
      .from("training_activities")
      .select("id", { count: "exact", head: true })
      .eq("activity_group_id", activityGroupId)
      .neq("publication_status", "archived"),
    supabaseAdmin
      .from("content_drafts")
      .select("id", { count: "exact", head: true })
      .eq("activity_group_id", activityGroupId)
      .neq("status", "archived"),
  ]);

  if (activityResult.error) {
    throw new Error(`Failed to count activity-group questions: ${activityResult.error.message}`);
  }
  if (draftResult.error) {
    throw new Error(`Failed to count activity-group drafts: ${draftResult.error.message}`);
  }
  if ((activityResult.count ?? 0) > 0 || (draftResult.count ?? 0) > 0) {
    return false;
  }

  const { error } = await supabaseAdmin
    .from("training_activity_groups")
    .delete()
    .eq("id", activityGroupId);

  if (error) {
    throw new Error(`Failed to delete empty activity group: ${error.message}`);
  }
  return true;
}

// GET /api/thinkertools-missions-create/drafts/[draftId]
export async function GET(request: Request, context: RouteContext) {
  try {
    const resolved = await resolveAndAuthorize(request, context);
    if (!resolved.ok) {
      return resolved.response;
    }

    const enriched = await enrichDraftMetadata(resolved.draft);
    return jsonSuccess({ draft: enriched }, { status: 200 });
  } catch (error) {
    return unexpectedError("Failed to get draft", error);
  }
}

// PATCH /api/thinkertools-missions-create/drafts/[draftId]
// Edits title, body, slug, and/or activity-group assignment. Promotes origin
// to co_authored if an AI-generated draft's authored content is edited.
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const resolved = await resolveAndAuthorize(request, context);
    if (!resolved.ok) {
      return resolved.response;
    }

    const parsedBody = await parseBody(request, patchDraftBodySchema);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { title, body, slug, activityGroupId } = parsedBody.data;
    const { draft } = resolved;

    let linkedActivity: { publication_status: "pending" | "live" } | null = null;

    if (activityGroupId !== undefined) {
      if (draft.contentType !== "activity") {
        return jsonError("Only activity drafts can be assigned to an activity group.", {
          status: 409,
          code: "AUTHORING_ACTIVITY_GROUP_INAPPLICABLE",
        });
      }

      if (activityGroupId !== null) {
        const { data: activityGroup, error: activityGroupError } = await supabaseAdmin
          .from("training_activity_groups")
          .select("id, training_id, publication_status")
          .eq("id", activityGroupId)
          .maybeSingle();

        if (activityGroupError) throw new Error(activityGroupError.message);
        if (!activityGroup || activityGroup.publication_status === "archived") {
          return jsonError("Activity group not found.", {
            status: 404,
            code: "AUTHORING_ACTIVITY_GROUP_NOT_FOUND",
          });
        }
        if (activityGroup.training_id !== draft.primaryTrainingId) {
          return jsonError("Choose an activity group from this draft's training subject.", {
            status: 409,
            code: "AUTHORING_ACTIVITY_GROUP_SUBJECT_MISMATCH",
          });
        }
      }

      if (draft.publishedRefId) {
        const { data: activity, error: activityError } = await supabaseAdmin
          .from("training_activities")
          .select("publication_status")
          .eq("id", draft.publishedRefId)
          .maybeSingle();

        if (activityError) throw new Error(activityError.message);
        linkedActivity = activity?.publication_status === "pending"
          || activity?.publication_status === "live"
          ? { publication_status: activity.publication_status }
          : null;
        if (linkedActivity?.publication_status === "live") {
          return jsonError("Live questions cannot be moved or removed from an activity group.", {
            status: 409,
            code: "AUTHORING_LIVE_ACTIVITY_GROUP_CHANGE_FORBIDDEN",
          });
        }
      }
    }

    const patch = buildDraftUpdatePatch(draft, {
      title,
      body,
      slug,
      activityGroupId,
    });

    const updated = await updateDraft(draft.id, patch);

    if (activityGroupId !== undefined && draft.publishedRefId && linkedActivity) {
      const { data: updatedActivity, error: activityUpdateError } = await supabaseAdmin
        .from("training_activities")
        .update({ activity_group_id: activityGroupId })
        .eq("id", draft.publishedRefId)
        .eq("publication_status", "pending")
        .select("id")
        .maybeSingle();

      if (activityUpdateError) {
        await updateDraft(draft.id, { activityGroupId: draft.activityGroupId });
        throw new Error(`Failed to update pending activity group: ${activityUpdateError.message}`);
      }
      if (!updatedActivity) {
        await updateDraft(draft.id, { activityGroupId: draft.activityGroupId });
        return jsonError("The question is no longer pending, so its activity group was not changed.", {
          status: 409,
          code: "AUTHORING_ACTIVITY_GROUP_CHANGE_STATUS_CONFLICT",
        });
      }
    }
    const enriched = await enrichDraftMetadata(updated);

    return jsonSuccess({ draft: enriched }, { status: 200 });
  } catch (error) {
    return unexpectedError("Failed to update draft", error);
  }
}

// DELETE /api/thinkertools-missions-create/drafts/[draftId]
// Permanently deletes an unpublished draft.
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const resolved = await resolveAndAuthorize(request, context);
    if (!resolved.ok) {
      return resolved.response;
    }

    if (resolved.draft.status === "published") {
      return jsonError("Published drafts cannot be deleted from the draft editor.", {
        status: 409,
        code: "AUTHORING_PUBLISHED_DRAFT_DELETE_FORBIDDEN",
      });
    }

    const activityGroupId = resolved.draft.activityGroupId;
    await deleteDraft(resolved.draft.id);
    const activityGroupDeleted = activityGroupId
      ? await deleteActivityGroupIfEmpty(activityGroupId)
      : false;

    return jsonSuccess(
      {
        deleted: true,
        activityGroupDeleted,
        deletedActivityGroupId: activityGroupDeleted ? activityGroupId : null,
      },
      { status: 200 },
    );
  } catch (error) {
    return unexpectedError("Failed to delete draft", error);
  }
}
