import "server-only";

import { z } from "zod";

import { runStructuredAi } from "@/lib/ai/client";
import { parseBody, unexpectedError } from "@/lib/api/route-utils";
import { requireActorIdFromRequest } from "@/lib/auth/actor";
import { jsonSuccess } from "@/lib/http";

const candidateSubjectSchema = z
  .object({
    id: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(500).optional(),
  })
  .strict();

const subjectShiftRequestSchema = z
  .object({
    currentSubject: candidateSubjectSchema,
    reply: z.string().trim().min(1).max(500),
    candidates: z.array(candidateSubjectSchema).min(1).max(30),
  })
  .strict();

const subjectShiftResponseSchema = z
  .object({
    shouldSwitch: z.boolean(),
    subjectId: z.string().trim().max(80).optional(),
  })
  .strict();

type SubjectShiftRequest = z.infer<typeof subjectShiftRequestSchema>;
type SubjectShiftResponse = z.infer<typeof subjectShiftResponseSchema>;

function buildSubjectShiftMock(): SubjectShiftResponse {
  return { shouldSwitch: false };
}

export async function POST(request: Request) {
  try {
    const actor = await requireActorIdFromRequest(request);
    if (!actor.ok) {
      return actor.response;
    }

    const parsedBody = await parseBody(request, subjectShiftRequestSchema);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const input: SubjectShiftRequest = parsedBody.data;
    const result = await runStructuredAi({
      feature: "authoring_activity",
      schema: subjectShiftResponseSchema,
      schemaName: "SubjectShiftResponse",
      systemPrompt: [
        "You decide whether an educator's reply belongs under the current subject or a different existing subject.",
        "Return shouldSwitch true only when the reply is clearly better categorized under one of the candidate subjects than the current subject.",
        "Use semantic subject knowledge, not just exact word overlap. For example, periodic table and elements belong with chemistry.",
        "If the reply is a normal refinement, subtopic, or content focus within the current subject, return shouldSwitch false.",
        "If no candidate is clearly better, return shouldSwitch false.",
        "When shouldSwitch is true, subjectId must be the id of the best candidate subject.",
        "Return only strict JSON that matches the schema.",
      ].join("\n"),
      userPrompt: [
        `Current subject: ${input.currentSubject.title}`,
        input.currentSubject.description ? `Current subject description: ${input.currentSubject.description}` : "",
        `Educator reply: ${input.reply}`,
        "Candidate subjects:",
        ...input.candidates.map((candidate) => [
          `- id: ${candidate.id}`,
          `  title: ${candidate.title}`,
          candidate.description ? `  description: ${candidate.description}` : "",
        ].filter(Boolean).join("\n")),
      ].filter(Boolean).join("\n"),
      mockResponse: buildSubjectShiftMock(),
      createdBy: actor.actorId,
    });

    return jsonSuccess(result.output, { status: 200 });
  } catch (error) {
    return unexpectedError("Failed to detect subject shift", error);
  }
}
