import "server-only";

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import { env } from "@/lib/env";
import { MOCK_AI_MODEL, type AiFeature, DEFAULT_AI_MODEL } from "@/lib/ai/schemas";
import { supabaseAdmin } from "@/lib/supabase/admin";

type StructuredCallStatus = "success" | "fallback";

type StructuredCallOptions<T> = {
  feature: AiFeature;
  schema: z.ZodType<T>;
  schemaName: string;
  systemPrompt: string;
  userPrompt: string;
  mockResponse: T;
  createdBy?: string | null;
  model?: string;
};

export type StructuredCallResult<T> = {
  output: T;
  model: string;
  status: StructuredCallStatus;
  source: "openai" | "mock";
};

let openAIClient: OpenAI | null = null;

const PREVIEW_MAX_CHARS = 800;

function clipPreview(value: string, max = PREVIEW_MAX_CHARS) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= max) {
    return compact;
  }

  return `${compact.slice(0, Math.max(0, max - 1))}...`;
}

function getOpenAIClient() {
  if (!env.OPENAI_API_KEY) {
    return null;
  }

  if (!openAIClient) {
    openAIClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }

  return openAIClient;
}

function asCreatedBy(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = z.string().uuid().safeParse(value);
  return parsed.success ? parsed.data : null;
}

async function logAiRun(input: {
  feature: AiFeature;
  model: string;
  status: StructuredCallStatus;
  latencyMs: number;
  promptPreview: string;
  responsePreview: string;
  createdBy?: string | null;
  inputTokens?: number;
  outputTokens?: number;
}) {
  const payload: Record<string, unknown> = {
    feature: input.feature,
    model: input.model,
    status: input.status,
    latency_ms: input.latencyMs,
    prompt_preview: clipPreview(input.promptPreview),
    response_preview: clipPreview(input.responsePreview),
    created_by: asCreatedBy(input.createdBy),
  };

  if (typeof input.inputTokens === "number") {
    payload.input_tokens = input.inputTokens;
  }

  if (typeof input.outputTokens === "number") {
    payload.output_tokens = input.outputTokens;
  }

  try {
    const { error } = await supabaseAdmin.from("ai_runs").insert(payload);
    if (error) {
      console.error("Failed to log ai run", {
        feature: input.feature,
        message: error.message,
      });
    }
  } catch (error) {
    console.error("Unexpected ai run logging failure", {
      feature: input.feature,
      error,
    });
  }
}

export async function runStructuredAi<T>(
  options: StructuredCallOptions<T>,
): Promise<StructuredCallResult<T>> {
  const startedAt = Date.now();
  const promptPreview = `${options.systemPrompt}\n\n${options.userPrompt}`;
  const mockOutput = options.schema.parse(options.mockResponse);
  const client = getOpenAIClient();

  if (!client) {
    const latencyMs = Date.now() - startedAt;
    await logAiRun({
      feature: options.feature,
      model: MOCK_AI_MODEL,
      status: "fallback",
      latencyMs,
      promptPreview,
      responsePreview: JSON.stringify(mockOutput),
      createdBy: options.createdBy,
    });

    return {
      output: mockOutput,
      model: MOCK_AI_MODEL,
      status: "fallback",
      source: "mock",
    };
  }

  const model = options.model ?? DEFAULT_AI_MODEL;

  try {
    const completion = await client.chat.completions.parse({
      model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: options.systemPrompt,
        },
        {
          role: "user",
          content: options.userPrompt,
        },
      ],
      response_format: zodResponseFormat(options.schema, options.schemaName),
    });

    const parsed = completion.choices[0]?.message?.parsed;
    if (!parsed) {
      throw new Error("Model returned no parsed response");
    }

    const output = options.schema.parse(parsed);
    const latencyMs = Date.now() - startedAt;

    await logAiRun({
      feature: options.feature,
      model: completion.model,
      status: "success",
      latencyMs,
      promptPreview,
      responsePreview: JSON.stringify(output),
      createdBy: options.createdBy,
      inputTokens: completion.usage?.prompt_tokens,
      outputTokens: completion.usage?.completion_tokens,
    });

    return {
      output,
      model: completion.model,
      status: "success",
      source: "openai",
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;

    await logAiRun({
      feature: options.feature,
      model,
      status: "fallback",
      latencyMs,
      promptPreview,
      responsePreview: JSON.stringify(mockOutput),
      createdBy: options.createdBy,
    });

    console.error("OpenAI call failed, served deterministic fallback", {
      feature: options.feature,
      error,
    });

    return {
      output: mockOutput,
      model: MOCK_AI_MODEL,
      status: "fallback",
      source: "mock",
    };
  }
}
