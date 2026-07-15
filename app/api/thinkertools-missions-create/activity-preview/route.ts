import "server-only";

import { z } from "zod";

import { runStructuredAi } from "@/lib/ai/client";
import { parseBody, unexpectedError } from "@/lib/api/route-utils";
import { requireActorIdFromRequest } from "@/lib/auth/actor";
import { activityBodySchema } from "@/lib/authoring/activity-schema";
import {
  buildAuthoringMock,
  buildAuthoringSystemPrompt,
  buildAuthoringUserPrompt,
  buildRefineSystemPrompt,
  buildRefineUserPrompt,
} from "@/lib/authoring/ai-prompts";
import { validateDraft } from "@/lib/authoring/validation";
import { jsonError, jsonSuccess } from "@/lib/http";

const previewBodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("generate"),
    description: z.string().trim().min(1).max(2000),
    model: z.string().trim().min(1).optional(),
  }),
  z.object({
    action: z.literal("refine"),
    currentBody: z.record(z.string(), z.unknown()),
    instruction: z.string().trim().min(1).max(2000),
    model: z.string().trim().min(1).optional(),
  }),
]);

// Generates or refines an activity body without creating a content_drafts row.
// The educator must explicitly save before this content is persisted.
export async function POST(request: Request) {
  try {
    const actor = await requireActorIdFromRequest(request);
    if (!actor.ok) return actor.response;

    const parsedBody = await parseBody(request, previewBodySchema);
    if (!parsedBody.ok) return parsedBody.response;

    const input = parsedBody.data;
    const isGenerate = input.action === "generate";
    const result = await runStructuredAi({
      feature: "authoring_activity",
      schema: activityBodySchema,
      schemaName: "ActivityBody",
      systemPrompt: isGenerate
        ? buildAuthoringSystemPrompt("activity")
        : buildRefineSystemPrompt("activity"),
      userPrompt: isGenerate
        ? buildAuthoringUserPrompt(input.description)
        : buildRefineUserPrompt(input.currentBody, input.instruction),
      mockResponse: isGenerate
        ? buildAuthoringMock("activity", input.description)
        : input.currentBody,
      model: input.model,
      createdBy: actor.actorId,
    });

    const validated = activityBodySchema.safeParse(result.output);
    if (!validated.success) {
      return jsonError("The request did not produce a complete activity question.", {
        status: 422,
        code: isGenerate ? "AUTHORING_AI_INCOMPLETE" : "AUTHORING_REFINE_INAPPLICABLE",
        details: {
          issues: validated.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      });
    }

    const validationIssues = validateDraft("activity", validated.data);
    if (validationIssues.length > 0) {
      return jsonError("The request did not produce a valid activity question.", {
        status: 422,
        code: isGenerate ? "AUTHORING_AI_INCOMPLETE" : "AUTHORING_REFINE_INAPPLICABLE",
        details: { issues: validationIssues },
      });
    }

    return jsonSuccess({
      body: validated.data,
      aiSource: result.source,
      aiModel: result.model,
    });
  } catch (error) {
    return unexpectedError("Failed to preview activity question", error);
  }
}
