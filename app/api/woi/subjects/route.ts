import "server-only";

import { z } from "zod";

import { runStructuredAi } from "@/lib/ai/client";
import { jsonError, jsonSuccess } from "@/lib/http";
import { requireActorId } from "@/lib/woi";

const requestSchema = z
  .object({
    mode: z.enum(["subjects", "question"]).default("subjects"),
    hint: z.preprocess(
      (value) => {
        if (typeof value !== "string") {
          return value;
        }
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
      },
      z.string().trim().min(1).max(200).optional(),
    ),
    subject: z.preprocess(
      (value) => {
        if (typeof value !== "string") {
          return value;
        }
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
      },
      z.string().trim().min(1).max(180).optional(),
    ),
    count: z.number().int().min(3).max(8).optional().default(6),
  })
  .strict();

const subjectsResponseSchema = z
  .object({
    subjects: z.array(z.string().trim().min(1).max(180)).min(3).max(8),
  })
  .strict();

const questionResponseSchema = z
  .object({
    subject: z.string().trim().min(1).max(180),
    question: z.string().trim().min(1).max(220),
  })
  .strict();

function clip(text: string, max: number) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, max - 1))}...`;
}

function buildMockSubjects(hint: string | undefined, count: number) {
  const base = hint ? clip(hint, 40) : "systems thinking";
  return subjectsResponseSchema.parse({
    subjects: [
      `${base}: fundamentals`,
      `${base}: key models`,
      `${base}: real-world examples`,
      `${base}: common mistakes`,
      `${base}: practical applications`,
      `${base}: advanced strategies`,
      `${base}: recent developments`,
      `${base}: expert debates`,
    ].slice(0, count),
  });
}

function buildMockQuestion(subject: string) {
  return questionResponseSchema.parse({
    subject: clip(subject, 180),
    question: `What are the most important ideas to understand first about ${clip(subject, 120)}?`,
  });
}

export async function POST(request: Request) {
  const actor = await requireActorId(request);
  if ("response" in actor) {
    return actor.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON", {
      status: 400,
      code: "INVALID_JSON",
    });
  }

  const parsedBody = requestSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("Invalid request body", {
      status: 400,
      code: "INVALID_BODY",
      details: parsedBody.error.flatten(),
    });
  }

  if (parsedBody.data.mode === "subjects") {
    const hint = parsedBody.data.hint;
    const aiResult = await runStructuredAi({
      feature: "template_generation",
      schema: subjectsResponseSchema,
      schemaName: "woi_subject_suggestions",
      systemPrompt:
        "You generate concise, high-value learning subjects. Return only strict JSON matching the schema.",
      userPrompt: [
        "Generate a diverse set of learning subjects for a WOI game.",
        "Each subject should be concise and specific.",
        "Avoid duplicates and overly broad wording.",
        `Count: ${parsedBody.data.count}`,
        hint ? `User interest hint: ${hint}` : "No user hint provided.",
      ].join("\n"),
      mockResponse: buildMockSubjects(hint, parsedBody.data.count),
      createdBy: actor.actorId,
    });

    return jsonSuccess(
      {
        subjects: aiResult.output.subjects,
        ai: {
          source: aiResult.source,
          model: aiResult.model,
          status: aiResult.status,
        },
      },
      { status: 200 },
    );
  }

  const subject = parsedBody.data.subject ?? parsedBody.data.hint;
  if (!subject) {
    return jsonError("A subject is required to generate a question", {
      status: 400,
      code: "SUBJECT_REQUIRED",
    });
  }

  const aiResult = await runStructuredAi({
    feature: "template_generation",
    schema: questionResponseSchema,
    schemaName: "woi_subject_question",
    systemPrompt:
      "You convert a subject into one clear, focused learning question. Return only strict JSON matching the schema.",
    userPrompt: [
      "Create one excellent learning question for this subject.",
      "The question must be clear, specific, and answerable through evidence.",
      `Subject: ${subject}`,
    ].join("\n"),
    mockResponse: buildMockQuestion(subject),
    createdBy: actor.actorId,
  });

  return jsonSuccess(
    {
      subject: aiResult.output.subject,
      question: aiResult.output.question,
      ai: {
        source: aiResult.source,
        model: aiResult.model,
        status: aiResult.status,
      },
    },
    { status: 200 },
  );
}
