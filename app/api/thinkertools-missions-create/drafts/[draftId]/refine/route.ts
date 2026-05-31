import "server-only";

import { z } from "zod";

import { runStructuredAi } from "@/lib/ai/client";
import { parseBody, parseWithSchema, unexpectedError } from "@/lib/api/route-utils";
import { requireActorIdFromRequest } from "@/lib/auth/actor";
import { activityBodySchema } from "@/lib/authoring/activity-schema";
import { buildRefineSystemPrompt, buildRefineUserPrompt } from "@/lib/authoring/ai-prompts";
import type { DraftOrigin } from "@/lib/authoring/draft-types";
import { missionBodySchema } from "@/lib/authoring/mission-schema";
import { getDraftById, updateDraft } from "@/lib/authoring/server";
import { validateDraft } from "@/lib/authoring/validation";
import { jsonError, jsonSuccess } from "@/lib/http";

type RouteContext = {
  params: Promise<{ draftId: string }>;
};

const draftParamsSchema = z.object({
  draftId: z.string().uuid(),
});

const refineBodySchema = z.object({
  instruction: z.string().trim().min(1).max(2000),
  model: z.string().trim().min(1).optional(),
});

// POST /api/thinkertools-missions-create/drafts/[draftId]/refine
// Accepts a single natural-language instruction, applies it to the current
// draft body via runStructuredAi (whole-object rewrite), re-validates, and
// persists the result.
//
// On inapplicable/ambiguous instruction or post-refine validation failure,
// returns AUTHORING_REFINE_INAPPLICABLE (422) and leaves the draft unchanged.
export async function POST(request: Request, context: RouteContext) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const actor = await requireActorIdFromRequest(request);
    if (!actor.ok) {
      return actor.response;
    }

    // ── Params ────────────────────────────────────────────────────────────
    const rawParams = await context.params;
    const parsedParams = parseWithSchema(rawParams, draftParamsSchema, "params");
    if (!parsedParams.ok) {
      return parsedParams.response;
    }

    const { draftId } = parsedParams.data;

    // ── Load draft + ownership check ──────────────────────────────────────
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

    // ── Parse request body ────────────────────────────────────────────────
    const parsedBody = await parseBody(request, refineBodySchema);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { instruction, model } = parsedBody.data;
    const currentBody = draft.body;
    const contentType = draft.contentType;

    // ── Select schema ─────────────────────────────────────────────────────
    const schema =
      contentType === "activity" ? activityBodySchema : missionBodySchema;
    const schemaName = contentType === "activity" ? "ActivityBody" : "MissionBody";
    const feature =
      contentType === "activity" ? "authoring_activity" : "authoring_mission";

    // ── Call AI (mockResponse = currentBody → "no change" on missing key) ─
    const result = await runStructuredAi({
      feature,
      schema,
      schemaName,
      systemPrompt: buildRefineSystemPrompt(contentType),
      userPrompt: buildRefineUserPrompt(currentBody, instruction),
      mockResponse: currentBody,
      model,
      createdBy: actor.actorId,
    });

    // ── Post-refine schema validation ─────────────────────────────────────
    // runStructuredAi already parses through the schema, but we run our full
    // validateDraft (which includes cross-field checks) to catch structural
    // issues the zod parse alone won't catch.
    const validationIssues = validateDraft(contentType, result.output);
    if (validationIssues.length > 0) {
      return jsonError(
        "Refinement instruction could not be applied or produced an invalid draft",
        {
          status: 422,
          code: "AUTHORING_REFINE_INAPPLICABLE",
          details: { issues: validationIssues },
        },
      );
    }

    // ── Determine new origin ──────────────────────────────────────────────
    // manual → co_authored (AI has now touched it)
    // ai     → ai (still purely AI-authored)
    // co_authored → co_authored (already mixed)
    const newOrigin: DraftOrigin =
      draft.origin === "manual" ? "co_authored" : draft.origin;

    // If a published draft is refined, return it to draft status
    const newStatus = draft.status === "published" ? "draft" : draft.status;

    // ── Persist ───────────────────────────────────────────────────────────
    const updated = await updateDraft(draft.id, {
      body: result.output,
      origin: newOrigin,
      status: newStatus === "published" ? "draft" : "valid",
      validationIssues: [],
      aiSource: result.source,
      aiModel: result.model,
    });

    return jsonSuccess(
      {
        draft: updated,
        aiSource: result.source,
        aiModel: result.model,
      },
      { status: 200 },
    );
  } catch (error) {
    return unexpectedError("Failed to refine draft", error);
  }
}
