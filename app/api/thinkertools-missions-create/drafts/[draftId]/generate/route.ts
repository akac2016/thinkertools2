import "server-only";

import { z } from "zod";

import { parseBody, parseWithSchema, unexpectedError } from "@/lib/api/route-utils";
import { requireActorIdFromRequest } from "@/lib/auth/actor";
import { runStructuredAi } from "@/lib/ai/client";
import { activityBodySchema } from "@/lib/authoring/activity-schema";
import { missionBodySchema } from "@/lib/authoring/mission-schema";
import {
  buildAuthoringSystemPrompt,
  buildAuthoringUserPrompt,
  buildAuthoringMock,
} from "@/lib/authoring/ai-prompts";
import { getDraftById, updateDraft } from "@/lib/authoring/server";
import { jsonError, jsonSuccess } from "@/lib/http";

type RouteContext = {
  params: Promise<{ draftId: string }>;
};

const draftParamsSchema = z.object({
  draftId: z.string().uuid(),
});

const generateBodySchema = z.object({
  description: z.string().trim().min(1).max(2000),
  model: z.string().trim().min(1).optional(),
});

// POST /api/thinkertools-missions-create/drafts/[draftId]/generate
// Accepts a natural-language description, calls runStructuredAi with the schema
// matching the draft's content type, and persists the result as the draft body.
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

    // --- Parse request body ---
    const parsedBody = await parseBody(request, generateBodySchema);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { description, model } = parsedBody.data;
    const contentType = draft.contentType;

    // --- Call runStructuredAi with the matching schema ---
    const isActivity = contentType === "activity";
    const schema = isActivity ? activityBodySchema : missionBodySchema;
    const schemaName = isActivity ? "ActivityBody" : "MissionBody";
    const feature = isActivity ? "authoring_activity" : "authoring_mission";
    const mockResponse = buildAuthoringMock(contentType, description);

    let result;
    try {
      result = await runStructuredAi({
        feature,
        schema,
        schemaName,
        systemPrompt: buildAuthoringSystemPrompt(contentType),
        userPrompt: buildAuthoringUserPrompt(description),
        mockResponse,
        model,
        createdBy: actor.actorId,
      });
    } catch (aiError) {
      // runStructuredAi itself should not throw (it falls back to mock), but guard anyway
      return unexpectedError("AI generation failed unexpectedly", aiError);
    }

    // --- Validate the output against the schema (catches vague descriptions) ---
    // runStructuredAi already parses with the schema, but if the AI returned a
    // structurally incomplete object the parse inside runStructuredAi would have
    // thrown and fallen back to the mock. We do a final safeParse here to detect
    // cases where the mock itself or the AI output has unfilled/empty required fields
    // that the schema's refinements would catch.
    const validated = schema.safeParse(result.output);
    if (!validated.success) {
      const unfilledFields = validated.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      return jsonError(
        "The description was too vague to produce a complete draft. Please provide more detail.",
        {
          status: 422,
          code: "AUTHORING_AI_INCOMPLETE",
          details: { unfilledFields },
        },
      );
    }

    // --- Determine new origin ---
    // manual → ai (first AI generation)
    // ai → ai (already AI, stays ai)
    // co_authored → co_authored (already mixed, stays co_authored)
    const newOrigin =
      draft.origin === "manual" ? "ai" : draft.origin;

    // --- Run validation and update status ---
    const { validateDraft } = await import("@/lib/authoring/validation");
    const validationIssues = validateDraft(draft.contentType, validated.data);
    const newStatus = validationIssues.length === 0 ? "valid" : "draft";

    // --- Persist result ---
    const updated = await updateDraft(draftId, {
      body: validated.data,
      aiSource: result.source,
      aiModel: result.model,
      origin: newOrigin,
      validationIssues,
      status: newStatus,
    });

    return jsonSuccess({ draft: updated, source: result.source, model: result.model }, { status: 200 });
  } catch (error) {
    return unexpectedError("Failed to generate draft", error);
  }
}
