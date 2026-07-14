import "server-only";

import { z } from "zod";

import { runStructuredAi } from "@/lib/ai/client";
import { parseBody, unexpectedError } from "@/lib/api/route-utils";
import { requireActorIdFromRequest } from "@/lib/auth/actor";
import { jsonSuccess } from "@/lib/http";

const ideaDirectionsRequestSchema = z
  .object({
    subject: z.string().trim().min(1).max(200),
    context: z.string().trim().max(600).optional(),
    count: z.number().int().min(3).max(6).default(5),
  })
  .strict();

const ideaDirectionOptionSchema = z
  .object({
    id: z.string().trim().min(1).max(8),
    label: z.string().trim().min(1).max(80),
    prompt: z.string().trim().min(1).max(300),
  })
  .strict();

const ideaDirectionsResponseSchema = z
  .object({
    options: z.array(ideaDirectionOptionSchema).min(3).max(6),
  })
  .strict();

type IdeaDirectionsRequest = z.infer<typeof ideaDirectionsRequestSchema>;
type IdeaDirectionsResponse = z.infer<typeof ideaDirectionsResponseSchema>;

function buildIdeaDirectionsMock(input: IdeaDirectionsRequest): IdeaDirectionsResponse {
  const directions = [
    {
      label: `Core concepts in ${input.subject}`,
      prompt: `${input.subject} focused on core terms, examples, and relationships learners should recognize.`,
    },
    {
      label: `Common misconceptions`,
      prompt: `${input.subject} focused on identifying and correcting common misconceptions.`,
    },
    {
      label: `Compare and classify`,
      prompt: `${input.subject} focused on comparing examples and classifying important differences.`,
    },
    {
      label: `Real-world applications`,
      prompt: `${input.subject} focused on short real-world scenarios that require applied reasoning.`,
    },
    {
      label: `Cause and effect`,
      prompt: `${input.subject} focused on explaining causes, effects, trade-offs, and consequences.`,
    },
    {
      label: `Evidence and reasoning`,
      prompt: `${input.subject} focused on evaluating evidence and choosing the best-supported claim.`,
    },
  ];

  return {
    options: directions.slice(0, input.count).map((direction, index) => ({
      id: String(index + 1),
      ...direction,
    })),
  };
}

export async function POST(request: Request) {
  try {
    const actor = await requireActorIdFromRequest(request);
    if (!actor.ok) {
      return actor.response;
    }

    const parsedBody = await parseBody(request, ideaDirectionsRequestSchema);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const input = parsedBody.data;
    const result = await runStructuredAi({
      feature: "authoring_activity",
      schema: ideaDirectionsResponseSchema,
      schemaName: "IdeaDirectionsResponse",
      systemPrompt: [
        "You are an expert instructional designer helping an educator start a set of short practice questions.",
        "Generate subject-specific starting directions for claim-based practice questions.",
        "Avoid generic placeholders and avoid assuming the subject is biology unless the subject says so.",
        "Each option needs a short label and a concrete prompt that can be used to generate practice questions.",
        "Return only strict JSON that matches the schema.",
      ].join("\n"),
      userPrompt: [
        `Subject: ${input.subject}`,
        input.context ? `Additional context: ${input.context}` : "",
        `Generate exactly ${input.count} starting directions.`,
      ].filter(Boolean).join("\n"),
      mockResponse: buildIdeaDirectionsMock(input),
      createdBy: actor.actorId,
    });

    return jsonSuccess(result.output, { status: 200 });
  } catch (error) {
    return unexpectedError("Failed to generate idea directions", error);
  }
}
