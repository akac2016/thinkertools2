import "server-only";

import { runStructuredAi } from "@/lib/ai/client";
import { getOptionalActorIdFromRequest } from "@/lib/auth/actor";
import { jsonError, jsonSuccess } from "@/lib/http";
import {
  buildTurnMock,
  formatValidationIssues,
  turnRequestSchema,
  turnResponseSchema,
} from "@/lib/ai/schemas";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", {
      status: 400,
      code: "INVALID_JSON",
    });
  }

  const parsedInput = turnRequestSchema.safeParse(body);
  if (!parsedInput.success) {
    return jsonError("Invalid request body", {
      status: 400,
      code: "VALIDATION_ERROR",
      details: formatValidationIssues(parsedInput.error),
    });
  }

  const actorId = await getOptionalActorIdFromRequest(request);
  const input = parsedInput.data;

  const result = await runStructuredAi({
    feature: "turn_assist",
    schema: turnResponseSchema,
    schemaName: "turn_assist_response",
    systemPrompt:
      "You assist with a single conversation turn. Return only strict JSON matching the schema. Keep guidance practical and safe.",
    userPrompt: [
      "Generate an assistant turn based on the provided conversation context and user intent.",
      "Input JSON:",
      JSON.stringify(input),
    ].join("\n"),
    mockResponse: buildTurnMock(input),
    createdBy: actorId,
  });

  return jsonSuccess(result.output, {
    status: 200,
  });
}
