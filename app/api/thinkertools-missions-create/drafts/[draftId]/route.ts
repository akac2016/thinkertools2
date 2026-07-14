import "server-only";

import { z } from "zod";

import { parseBody, parseWithSchema, unexpectedError } from "@/lib/api/route-utils";
import { requireActorIdFromRequest } from "@/lib/auth/actor";
import {
  archiveDraft,
  getDraftById,
  updateDraft,
} from "@/lib/authoring/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateDraft } from "@/lib/authoring/validation";
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

  const [trainingResult, groupResult] = await Promise.all([
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
  ]);

  return {
    ...draft,
    trainingTitle: trainingResult.data?.title ?? null,
    activityGroupTitle: groupResult.data?.title ?? null,
  };
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
// Edits title, body, and/or slug. Promotes origin to co_authored if the draft
// was AI-generated.
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

    const { title, body, slug } = parsedBody.data;
    const { draft } = resolved;

    // Determine the new origin:
    // - If the draft was AI-generated (origin === 'ai'), promote to 'co_authored'
    // - If it was already 'co_authored' or 'manual', keep it unchanged
    const newOrigin =
      draft.origin === "ai" ? "co_authored" : draft.origin;

    // If a published draft is edited, return it to draft status
    const newStatus = draft.status === "published" ? "draft" : draft.status;

    const patch: Parameters<typeof updateDraft>[1] = {
      origin: newOrigin,
      status: newStatus,
    };
    if (title !== undefined) patch.title = title;
    if (body !== undefined) patch.body = body;
    if (slug !== undefined) patch.slug = slug;

    // Re-run validation whenever the body changes (or on any edit, to keep
    // validation_issues and status in sync with the current body)
    const effectiveBody = body !== undefined ? body : draft.body;
    const validationIssues = validateDraft(draft.contentType, effectiveBody);
    // Only promote to 'valid' if the draft isn't being returned to 'draft' by
    // a published-edit transition (newStatus already handles that case)
    if (newStatus !== "draft") {
      patch.status = validationIssues.length === 0 ? "valid" : "draft";
    }
    patch.validationIssues = validationIssues;

    const updated = await updateDraft(draft.id, patch);

    return jsonSuccess({ draft: updated }, { status: 200 });
  } catch (error) {
    return unexpectedError("Failed to update draft", error);
  }
}

// DELETE /api/thinkertools-missions-create/drafts/[draftId]
// Soft-deletes (archives) the draft.
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const resolved = await resolveAndAuthorize(request, context);
    if (!resolved.ok) {
      return resolved.response;
    }

    await archiveDraft(resolved.draft.id);

    return jsonSuccess({ archived: true }, { status: 200 });
  } catch (error) {
    return unexpectedError("Failed to archive draft", error);
  }
}
