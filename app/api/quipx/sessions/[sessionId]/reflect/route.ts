import "server-only";

import { z } from "zod";

import {
  databaseError,
  parseBody,
  parseWithSchema,
  requireDemoActorId,
  unexpectedError,
} from "@/lib/api/route-utils";
import { jsonError, jsonSuccess } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

type ReflectItemRow = {
  id: string;
  label: string;
  short_text: string;
  long_text: string;
  order_index: number;
};

type ReflectionRow = {
  id: string;
  session_id: string;
  reflect_item_id: string;
  user_id: string;
  score: number;
  justification: string;
  created_at: string;
  updated_at: string;
};

type ResponseRow = {
  reflect_item_id: string;
  score: number;
  text: string;
};

const sessionParamsSchema = z.object({
  sessionId: z.string().uuid(),
});

const upsertReflectionBodySchema = z.object({
  reflectItemId: z.string().uuid(),
  score: z.coerce.number().int().min(1).max(5),
  justification: z
    .preprocess(
      (value) => (value === undefined || value === null ? "" : value),
      z.string().trim().max(5000),
    )
    .optional()
    .default(""),
});

function mapReflection(row: ReflectionRow, responseText: string | null) {
  return {
    id: row.id,
    sessionId: row.session_id,
    reflectItemId: row.reflect_item_id,
    userId: row.user_id,
    score: row.score,
    justification: row.justification,
    responseText,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function ensureSessionExists(sessionId: string) {
  const { data, error } = await supabaseAdmin
    .from("quipx_sessions")
    .select("id")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      response: databaseError("Failed to validate Quipx session", error),
    };
  }

  if (!data) {
    return {
      ok: false as const,
      response: jsonError("Quipx session not found", {
        status: 404,
        code: "SESSION_NOT_FOUND",
      }),
    };
  }

  return { ok: true as const };
}

async function ensureReflectItemExists(reflectItemId: string) {
  const { data, error } = await supabaseAdmin
    .from("quipx_reflect_items")
    .select("id")
    .eq("id", reflectItemId)
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      response: databaseError("Failed to validate reflect item", error),
    };
  }

  if (!data) {
    return {
      ok: false as const,
      response: jsonError("Reflect item not found", {
        status: 404,
        code: "REFLECT_ITEM_NOT_FOUND",
      }),
    };
  }

  return { ok: true as const };
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const actor = await requireDemoActorId(request);
    if (!actor.ok) {
      return actor.response;
    }

    const rawParams = await context.params;
    const parsedParams = parseWithSchema(rawParams, sessionParamsSchema, "params");
    if (!parsedParams.ok) {
      return parsedParams.response;
    }

    const parsedBody = await parseBody(request, upsertReflectionBodySchema);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const sessionCheck = await ensureSessionExists(parsedParams.data.sessionId);
    if (!sessionCheck.ok) {
      return sessionCheck.response;
    }

    const itemCheck = await ensureReflectItemExists(parsedBody.data.reflectItemId);
    if (!itemCheck.ok) {
      return itemCheck.response;
    }

    const now = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("quipx_reflections")
      .upsert(
        {
          session_id: parsedParams.data.sessionId,
          reflect_item_id: parsedBody.data.reflectItemId,
          user_id: actor.actorId,
          score: parsedBody.data.score,
          justification: parsedBody.data.justification,
          updated_at: now,
        },
        {
          onConflict: "session_id,reflect_item_id,user_id",
        },
      )
      .select(
        "id, session_id, reflect_item_id, user_id, score, justification, created_at, updated_at",
      )
      .single();

    if (error) {
      return databaseError("Failed to upsert reflection", error);
    }

    const { data: responseData, error: responseError } = await supabaseAdmin
      .from("quipx_reflect_responses")
      .select("text")
      .eq("reflect_item_id", parsedBody.data.reflectItemId)
      .eq("score", parsedBody.data.score)
      .maybeSingle();

    if (responseError) {
      return databaseError("Failed to load mapped response text", responseError);
    }

    return jsonSuccess(
      {
        reflection: mapReflection(
          data as ReflectionRow,
          responseData ? (responseData as { text: string }).text : null,
        ),
      },
      { status: 200 },
    );
  } catch (error) {
    return unexpectedError("Failed to upsert reflection", error);
  }
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const actor = await requireDemoActorId(request);
    if (!actor.ok) {
      return actor.response;
    }

    const rawParams = await context.params;
    const parsedParams = parseWithSchema(rawParams, sessionParamsSchema, "params");
    if (!parsedParams.ok) {
      return parsedParams.response;
    }

    const { sessionId } = parsedParams.data;

    const sessionCheck = await ensureSessionExists(sessionId);
    if (!sessionCheck.ok) {
      return sessionCheck.response;
    }

    const [itemsResult, reflectionsResult, responsesResult] = await Promise.all([
      supabaseAdmin
        .from("quipx_reflect_items")
        .select("id, label, short_text, long_text, order_index")
        .order("order_index", { ascending: true }),
      supabaseAdmin
        .from("quipx_reflections")
        .select(
          "id, session_id, reflect_item_id, user_id, score, justification, created_at, updated_at",
        )
        .eq("session_id", sessionId)
        .eq("user_id", actor.actorId),
      supabaseAdmin
        .from("quipx_reflect_responses")
        .select("reflect_item_id, score, text"),
    ]);

    if (itemsResult.error) {
      return databaseError("Failed to load reflect items", itemsResult.error);
    }

    if (reflectionsResult.error) {
      return databaseError("Failed to load reflections", reflectionsResult.error);
    }

    if (responsesResult.error) {
      return databaseError("Failed to load reflect responses", responsesResult.error);
    }

    const items = (itemsResult.data ?? []) as ReflectItemRow[];
    const reflections = (reflectionsResult.data ?? []) as ReflectionRow[];
    const responses = (responsesResult.data ?? []) as ResponseRow[];

    const responseTextByItemAndScore = new Map<string, string>();
    for (const response of responses) {
      responseTextByItemAndScore.set(
        `${response.reflect_item_id}:${response.score}`,
        response.text,
      );
    }

    const reflectionByItemId = new Map<string, ReturnType<typeof mapReflection>>();
    for (const reflection of reflections) {
      const key = `${reflection.reflect_item_id}:${reflection.score}`;
      const responseText = responseTextByItemAndScore.get(key) ?? null;
      reflectionByItemId.set(
        reflection.reflect_item_id,
        mapReflection(reflection, responseText),
      );
    }

    const mappedItems = items.map((item) => ({
      itemId: item.id,
      label: item.label,
      shortText: item.short_text,
      longText: item.long_text,
      orderIndex: item.order_index,
      reflection: reflectionByItemId.get(item.id) ?? null,
    }));

    return jsonSuccess(
      {
        sessionId,
        userId: actor.actorId,
        items: mappedItems,
        reflectionCount: reflections.length,
      },
      { status: 200 },
    );
  } catch (error) {
    return unexpectedError("Failed to load user reflections", error);
  }
}
