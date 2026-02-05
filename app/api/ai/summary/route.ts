import "server-only";

import { runStructuredAi } from "@/lib/ai/client";
import { getDemoActorFromRequest } from "@/lib/demo-auth";
import { jsonError, jsonSuccess } from "@/lib/http";
import {
  buildSummaryMock,
  formatValidationIssues,
  summaryRequestSchema,
  summaryResponseSchema,
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

  const parsedInput = summaryRequestSchema.safeParse(body);
  if (!parsedInput.success) {
    return jsonError("Invalid request body", {
      status: 400,
      code: "VALIDATION_ERROR",
      details: formatValidationIssues(parsedInput.error),
    });
  }

  const actor = getDemoActorFromRequest(request);
  const input = parsedInput.data;

  const result = await runStructuredAi({
    feature: "summary",
    schema: summaryResponseSchema,
    schemaName: "summary_response",
    systemPrompt:
      "You produce concise summaries for demo workflows. Return only strict JSON that matches the schema. Do not include markdown.",
    userPrompt: [
      "Summarize this content and produce actionable output.",
      "Input JSON:",
      JSON.stringify(input),
    ].join("\n"),
    mockResponse: buildSummaryMock(input),
    createdBy: actor.userId,
  });

  return jsonSuccess(result.output, {
    status: 200,
  });
}
