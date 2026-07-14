import "server-only";

import { z } from "zod";

import { parseWithSchema, unexpectedError } from "@/lib/api/route-utils";
import { requireActorIdFromRequest } from "@/lib/auth/actor";
import { getDraftById } from "@/lib/authoring/server";
import { jsonError, jsonSuccess } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ draftId: string }>;
};

const draftParamsSchema = z.object({
  draftId: z.string().uuid(),
});

// POST /api/thinkertools-missions-create/drafts/[draftId]/release
// Flips a published draft's live content from 'pending' → 'live', making it visible to players.
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

    // --- Require status === 'published' ---
    if (draft.status !== "published") {
      return jsonError(
        "Draft must be published before it can be released.",
        {
          status: 409,
          code: "AUTHORING_RELEASE_NOT_PUBLISHED",
        },
      );
    }

    if (!draft.publishedRefId) {
      return jsonError(
        "Draft has no published reference ID.",
        {
          status: 409,
          code: "AUTHORING_RELEASE_NO_REF",
        },
      );
    }

    // --- Determine the table to update ---
    const tableName = draft.contentType === "mission" ? "missions" : "training_activities";

    // --- Check current publication_status ---
    const { data: currentRow, error: fetchError } = await supabaseAdmin
      .from(tableName)
      .select("publication_status")
      .eq("id", draft.publishedRefId)
      .maybeSingle();

    if (fetchError) {
      throw new Error(`Failed to fetch published content: ${fetchError.message}`);
    }

    if (!currentRow) {
      return jsonError(
        "Published content not found. It may have been deleted.",
        {
          status: 404,
          code: "AUTHORING_PUBLISHED_CONTENT_NOT_FOUND",
        },
      );
    }

    if (currentRow.publication_status === "live") {
      // Already live — idempotent success
      return jsonSuccess(
        {
          message: "Content is already live.",
          contentType: draft.contentType,
          contentId: draft.publishedRefId,
        },
        { status: 200 },
      );
    }

    if (currentRow.publication_status === "archived") {
      return jsonError(
        "Cannot release archived content. Restore it first.",
        {
          status: 409,
          code: "AUTHORING_RELEASE_ARCHIVED",
        },
      );
    }

    // --- Flip publication_status to 'live' ---
    const { error: updateError } = await supabaseAdmin
      .from(tableName)
      .update({ publication_status: "live", updated_at: new Date().toISOString() })
      .eq("id", draft.publishedRefId);

    if (updateError) {
      throw new Error(`Failed to update publication status: ${updateError.message}`);
    }

    return jsonSuccess(
      {
        message: "Content is now live.",
        contentType: draft.contentType,
        contentId: draft.publishedRefId,
      },
      { status: 200 },
    );
  } catch (error) {
    return unexpectedError("Failed to release draft", error);
  }
}
