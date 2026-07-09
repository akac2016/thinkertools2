import "server-only";

import { z } from "zod";

import { runStructuredAi } from "@/lib/ai/client";
import { parseBody, unexpectedError } from "@/lib/api/route-utils";
import { requireActorIdFromRequest } from "@/lib/auth/actor";
import { jsonSuccess } from "@/lib/http";

const ideaReplyOptionSchema = z
  .object({
    id: z.string().trim().min(1).max(8),
    label: z.string().trim().min(1).max(80),
    prompt: z.string().trim().min(1).max(300),
  })
  .strict();

const ideaReplyRequestSchema = z
  .object({
    subject: z.string().trim().min(1).max(200),
    reply: z.string().trim().min(1).max(500),
    options: z.array(ideaReplyOptionSchema).min(1).max(6),
  })
  .strict();

const ideaReplyResponseSchema = z
  .object({
    intent: z.enum(["revise_directions", "draft_focus"]),
    refinement: z.string().trim().max(300).optional(),
    focus: z.string().trim().max(300).optional(),
  })
  .strict();

type IdeaReplyRequest = z.infer<typeof ideaReplyRequestSchema>;
type IdeaReplyResponse = z.infer<typeof ideaReplyResponseSchema>;

function buildIdeaReplyMock(input: IdeaReplyRequest): IdeaReplyResponse {
  return {
    intent: "revise_directions",
    refinement: input.reply,
  };
}

export async function POST(request: Request) {
  try {
    const actor = await requireActorIdFromRequest(request);
    if (!actor.ok) {
      return actor.response;
    }

    const parsedBody = await parseBody(request, ideaReplyRequestSchema);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const input = parsedBody.data;
    const result = await runStructuredAi({
      feature: "authoring_activity",
      schema: ideaReplyResponseSchema,
      schemaName: "IdeaReplyResponse",
      systemPrompt: [
        "You classify an educator's reply during an instructional-design brainstorming step.",
        "The educator has just seen possible starting directions for short practice questions.",
        "Classify the reply as revise_directions when they are asking for different, narrower, broader, harder, easier, more technical, more concrete, or otherwise adjusted suggestions.",
        "Classify the reply as draft_focus only when it is clearly a final content focus ready to generate questions from.",
        "If the reply is ambiguous or conversational, choose revise_directions so the app keeps brainstorming instead of generating too early.",
        "Return only strict JSON that matches the schema.",
      ].join("\n"),
      userPrompt: [
        `Subject: ${input.subject}`,
        "Current options:",
        ...input.options.map((option) => `${option.id}. ${option.label}: ${option.prompt}`),
        `Educator reply: ${input.reply}`,
      ].join("\n"),
      mockResponse: buildIdeaReplyMock(input),
      createdBy: actor.actorId,
    });

    return jsonSuccess(result.output, { status: 200 });
  } catch (error) {
    return unexpectedError("Failed to interpret idea reply", error);
  }
}
