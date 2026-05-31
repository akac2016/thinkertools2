import "server-only";

import { z } from "zod";

import { parseBody, parseWithSchema, unexpectedError } from "@/lib/api/route-utils";
import { requireActorIdFromRequest } from "@/lib/auth/actor";
import { getDraftById } from "@/lib/authoring/server";
import { jsonError, jsonSuccess } from "@/lib/http";
import {
  RECOVERABLE_INVALID_INPUT_MESSAGE,
  extractCorrectAnswerLabels,
  extractExpectedAnswerCount,
  extractExplanation,
  extractPromptClaims,
  isMatchingLabelPair,
  matchConstrainedTypedInput,
  normalizeLabelSelection,
  type TrainingActivityRoundContent,
} from "@/lib/quests";

type RouteContext = {
  params: Promise<{ draftId: string }>;
};

const draftParamsSchema = z.object({
  draftId: z.string().uuid(),
});

const previewSubmitBodySchema = z.object({
  selectedLabels: z.array(z.string().trim().min(1).max(16)).max(2).optional(),
  typedAnswer: z.string().max(120).optional(),
});

// POST /api/thinkertools-missions-create/drafts/[draftId]/preview-submit
//
// Runs the same grading logic as the real submit route but writes NO attempts
// or progress — preview play is side-effect-free (Req 7.3).
// Only the draft owner may call this endpoint (Req 7.4).
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

    // --- Load draft ---
    const draft = await getDraftById(parsedParams.data.draftId);
    if (!draft) {
      return jsonError("Draft not found", {
        status: 404,
        code: "AUTHORING_DRAFT_NOT_FOUND",
      });
    }

    // --- Ownership check (Req 7.4) ---
    if (draft.createdBy !== actor.actorId) {
      return jsonError("You do not have permission to preview this draft", {
        status: 403,
        code: "AUTHORING_DRAFT_FORBIDDEN",
      });
    }

    // --- Parse request body ---
    const parsedBody = await parseBody(request, previewSubmitBodySchema);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    // --- Extract grading data from the draft body ---
    // The draft body is the same shape as training_activities.round_content.
    const roundContent = draft.body as TrainingActivityRoundContent;

    const promptClaims = extractPromptClaims(roundContent);
    const visibleLabels = promptClaims.map((claim) => claim.label);
    const correctAnswerLabels = extractCorrectAnswerLabels(roundContent);
    const expectedCount = extractExpectedAnswerCount(roundContent);

    if (
      visibleLabels.length < expectedCount ||
      correctAnswerLabels.length !== expectedCount
    ) {
      return jsonError("Draft activity is misconfigured — cannot grade", {
        status: 422,
        code: "AUTHORING_VALIDATION_FAILED",
        details: {
          reason: "misconfigured_round_content",
        },
      });
    }

    // --- Resolve the selection (same logic as the real submit route) ---
    const clickSelection = normalizeLabelSelection(
      parsedBody.data.selectedLabels ?? [],
    );
    const typedAnswer = (parsedBody.data.typedAnswer ?? "").trim();

    // Reject a label selection with the wrong count early.
    if (
      parsedBody.data.selectedLabels !== undefined &&
      parsedBody.data.selectedLabels.length > 0 &&
      parsedBody.data.selectedLabels.length !== expectedCount
    ) {
      return jsonError(RECOVERABLE_INVALID_INPUT_MESSAGE, {
        status: 422,
        code: "MISSIONS_SELECTION_REQUIRED",
        details: {
          reason: "wrong_selection_count",
          recoverable: true,
        },
      });
    }

    let resolvedSelection: string[] | null = null;

    const clickSelectionIsValid =
      clickSelection.length === expectedCount &&
      clickSelection.every((label) => visibleLabels.includes(label));

    if (clickSelectionIsValid) {
      resolvedSelection = clickSelection;
    } else if (typedAnswer) {
      const typedMatch = matchConstrainedTypedInput(typedAnswer, {
        visibleOptionLabels: visibleLabels,
        expectedSelectionCount: expectedCount,
      });

      if (typedMatch.status === "invalid_input") {
        return jsonError(typedMatch.recoverableMessage, {
          status: 422,
          code: "MISSIONS_INVALID_TYPED_SELECTION",
          details: {
            reason: typedMatch.reason,
            normalizedInput: typedMatch.normalizedInput,
            recoverable: true,
          },
        });
      }

      resolvedSelection = normalizeLabelSelection(typedMatch.selectedLabels);
    } else {
      return jsonError(RECOVERABLE_INVALID_INPUT_MESSAGE, {
        status: 422,
        code: "MISSIONS_SELECTION_REQUIRED",
        details: {
          reason:
            clickSelection.length > 0 ? "wrong_selection_count" : "empty_input",
          recoverable: true,
        },
      });
    }

    if (!resolvedSelection || resolvedSelection.length !== expectedCount) {
      return jsonError(RECOVERABLE_INVALID_INPUT_MESSAGE, {
        status: 422,
        code: "MISSIONS_SELECTION_REQUIRED",
        details: {
          reason: "wrong_selection_count",
          recoverable: true,
        },
      });
    }

    // --- Grade (Req 7.2) ---
    const wasCorrect = isMatchingLabelPair(resolvedSelection, correctAnswerLabels);
    const explanation = extractExplanation(roundContent);

    // --- Return result — NO writes to attempts/progress (Req 7.3) ---
    return jsonSuccess({
      wasCorrect,
      selectedLabels: resolvedSelection,
      correctAnswerLabels,
      explanation,
    });
  } catch (error) {
    return unexpectedError("Unexpected error during preview submission", error);
  }
}
