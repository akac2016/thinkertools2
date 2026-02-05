import "server-only";

import { z } from "zod";

import {
  databaseError,
  parseWithSchema,
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

type ReflectionScoreRow = {
  reflect_item_id: string;
  score: number;
};

type ReflectResponseRow = {
  id: string;
  reflect_item_id: string;
  score: number;
  text: string;
};

type ImproveStrategyRow = {
  reflect_response_id: string;
  strategy_text: string;
};

const sessionParamsSchema = z.object({
  sessionId: z.string().uuid(),
});

function clampScore(score: number) {
  return Math.max(1, Math.min(5, score));
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const rawParams = await context.params;
    const parsedParams = parseWithSchema(rawParams, sessionParamsSchema, "params");
    if (!parsedParams.ok) {
      return parsedParams.response;
    }

    const { sessionId } = parsedParams.data;

    const { data: sessionData, error: sessionError } = await supabaseAdmin
      .from("quipx_sessions")
      .select("id")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError) {
      return databaseError("Failed to validate Quipx session", sessionError);
    }

    if (!sessionData) {
      return jsonError("Quipx session not found", {
        status: 404,
        code: "SESSION_NOT_FOUND",
      });
    }

    const [itemsResult, reflectionsResult, responsesResult, strategiesResult] =
      await Promise.all([
        supabaseAdmin
          .from("quipx_reflect_items")
          .select("id, label, short_text, long_text, order_index")
          .order("order_index", { ascending: true }),
        supabaseAdmin
          .from("quipx_reflections")
          .select("reflect_item_id, score")
          .eq("session_id", sessionId),
        supabaseAdmin
          .from("quipx_reflect_responses")
          .select("id, reflect_item_id, score, text"),
        supabaseAdmin
          .from("quipx_improve_strategies")
          .select("reflect_response_id, strategy_text"),
      ]);

    if (itemsResult.error) {
      return databaseError("Failed to load reflect items", itemsResult.error);
    }

    if (reflectionsResult.error) {
      return databaseError("Failed to load reflection scores", reflectionsResult.error);
    }

    if (responsesResult.error) {
      return databaseError("Failed to load reflect responses", responsesResult.error);
    }

    if (strategiesResult.error) {
      return databaseError("Failed to load improvement strategies", strategiesResult.error);
    }

    const items = (itemsResult.data ?? []) as ReflectItemRow[];
    const reflectionScores = (reflectionsResult.data ?? []) as ReflectionScoreRow[];
    const reflectResponses = (responsesResult.data ?? []) as ReflectResponseRow[];
    const improveStrategies = (strategiesResult.data ?? []) as ImproveStrategyRow[];

    const responsesByItemAndScore = new Map<string, ReflectResponseRow>();
    for (const response of reflectResponses) {
      responsesByItemAndScore.set(
        `${response.reflect_item_id}:${response.score}`,
        response,
      );
    }

    const strategiesByResponseId = new Map<string, string[]>();
    for (const strategy of improveStrategies) {
      const current = strategiesByResponseId.get(strategy.reflect_response_id) ?? [];
      current.push(strategy.strategy_text);
      strategiesByResponseId.set(strategy.reflect_response_id, current);
    }

    const aggregatesByItemId = new Map<
      string,
      {
        scoreTotal: number;
        scoreCount: number;
        scoreBreakdown: Record<1 | 2 | 3 | 4 | 5, number>;
      }
    >();

    for (const reflection of reflectionScores) {
      const current =
        aggregatesByItemId.get(reflection.reflect_item_id) ?? {
          scoreTotal: 0,
          scoreCount: 0,
          scoreBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        };

      const safeScore = clampScore(reflection.score) as 1 | 2 | 3 | 4 | 5;
      current.scoreTotal += reflection.score;
      current.scoreCount += 1;
      current.scoreBreakdown[safeScore] += 1;
      aggregatesByItemId.set(reflection.reflect_item_id, current);
    }

    const totalScore = reflectionScores.reduce((sum, row) => sum + row.score, 0);
    const totalReflections = reflectionScores.length;

    const mappedItems = items.map((item) => {
      const aggregate = aggregatesByItemId.get(item.id);
      const responsesCount = aggregate?.scoreCount ?? 0;
      const averageScore =
        responsesCount > 0
          ? Number((aggregate!.scoreTotal / responsesCount).toFixed(2))
          : null;
      const recommendedScore =
        averageScore !== null
          ? (clampScore(Math.round(averageScore)) as 1 | 2 | 3 | 4 | 5)
          : null;

      const mappedResponse =
        recommendedScore !== null
          ? responsesByItemAndScore.get(`${item.id}:${recommendedScore}`) ?? null
          : null;

      const strategies = mappedResponse
        ? strategiesByResponseId.get(mappedResponse.id) ?? []
        : [];

      return {
        itemId: item.id,
        label: item.label,
        shortText: item.short_text,
        longText: item.long_text,
        orderIndex: item.order_index,
        responsesCount,
        averageScore,
        scoreBreakdown: aggregate?.scoreBreakdown ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        mappedResponse: mappedResponse
          ? {
              score: mappedResponse.score,
              text: mappedResponse.text,
            }
          : null,
        strategies,
      };
    });

    return jsonSuccess(
      {
        sessionId,
        totalReflections,
        overallAverageScore:
          totalReflections > 0
            ? Number((totalScore / totalReflections).toFixed(2))
            : null,
        items: mappedItems,
      },
      { status: 200 },
    );
  } catch (error) {
    return unexpectedError("Failed to build improve payload", error);
  }
}
