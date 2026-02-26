import "server-only";

import { runStructuredAi } from "@/lib/ai/client";
import { getOptionalActorIdFromRequest } from "@/lib/auth/actor";
import { jsonError, jsonSuccess } from "@/lib/http";
import {
  buildTemplateMock,
  formatValidationIssues,
  templateRequestSchema,
  templateResponseSchema,
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

  const parsedInput = templateRequestSchema.safeParse(body);
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
    feature: "template_generation",
    schema: templateResponseSchema,
    schemaName: "template_generation_response",
    systemPrompt:
      "You generate high-signal templates for workflow demos. Return only strict JSON that matches the provided schema. Do not include markdown.",
    userPrompt: [
      "Create a reusable template from this input.",
      "Input JSON:",
      JSON.stringify(input),
    ].join("\n"),
    mockResponse: buildTemplateMock(input),
    createdBy: actorId,
  });

  return jsonSuccess(result.output, {
    status: 200,
  });
}
