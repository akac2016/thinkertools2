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

type SessionRow = {
  id: string;
  team_id: string;
  creator_id: string;
  subject: string;
  objectives: string;
  starts_at: string | null;
  duration_min: number | null;
  status: "active" | "closed" | "archived";
  created_at: string;
};

type ReflectItemRow = {
  id: string;
  label: string;
  short_text: string;
  long_text: string;
  order_index: number;
};

type ReflectionRow = {
  reflect_item_id: string;
  score: number;
  user_id: string;
};

type DiscussRow = {
  author_id: string;
  created_at: string;
};

const sessionParamsSchema = z.object({
  sessionId: z.string().uuid(),
});

function mapSession(row: SessionRow) {
  return {
    id: row.id,
    teamId: row.team_id,
    creatorId: row.creator_id,
    subject: row.subject,
    objectives: row.objectives,
    startsAt: row.starts_at,
    durationMin: row.duration_min,
    status: row.status,
    createdAt: row.created_at,
  };
}

function summarizeItemStrength(averageScore: number) {
  if (averageScore >= 4.5) {
    return "Top-performing collaboration pattern.";
  }

  if (averageScore >= 4) {
    return "Strong result with minor gaps.";
  }

  if (averageScore >= 3) {
    return "Mixed result with room to improve.";
  }

  return "Below target and needs focused follow-up.";
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
      .select(
        "id, team_id, creator_id, subject, objectives, starts_at, duration_min, status, created_at",
      )
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError) {
      return databaseError("Failed to load Quipx session", sessionError);
    }

    if (!sessionData) {
      return jsonError("Quipx session not found", {
        status: 404,
        code: "SESSION_NOT_FOUND",
      });
    }

    const [itemsResult, reflectionsResult, discussResult] = await Promise.all([
      supabaseAdmin
        .from("quipx_reflect_items")
        .select("id, label, short_text, long_text, order_index")
        .order("order_index", { ascending: true }),
      supabaseAdmin
        .from("quipx_reflections")
        .select("reflect_item_id, score, user_id")
        .eq("session_id", sessionId),
      supabaseAdmin
        .from("quipx_discuss_entries")
        .select("author_id, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true }),
    ]);

    if (itemsResult.error) {
      return databaseError("Failed to load reflect items", itemsResult.error);
    }

    if (reflectionsResult.error) {
      return databaseError("Failed to load reflection results", reflectionsResult.error);
    }

    if (discussResult.error) {
      return databaseError("Failed to load discussion results", discussResult.error);
    }

    const items = (itemsResult.data ?? []) as ReflectItemRow[];
    const reflections = (reflectionsResult.data ?? []) as ReflectionRow[];
    const discussEntries = (discussResult.data ?? []) as DiscussRow[];

    const statsByItem = new Map<string, { total: number; count: number }>();
    for (const reflection of reflections) {
      const current = statsByItem.get(reflection.reflect_item_id) ?? { total: 0, count: 0 };
      current.total += reflection.score;
      current.count += 1;
      statsByItem.set(reflection.reflect_item_id, current);
    }

    const itemSummaries = items
      .map((item) => {
        const aggregate = statsByItem.get(item.id);
        const responsesCount = aggregate?.count ?? 0;
        const averageScore =
          responsesCount > 0
            ? Number((aggregate!.total / responsesCount).toFixed(2))
            : null;

        return {
          itemId: item.id,
          label: item.label,
          shortText: item.short_text,
          longText: item.long_text,
          orderIndex: item.order_index,
          responsesCount,
          averageScore,
        };
      })
      .filter((item) => item.averageScore !== null);

    const sortedByStrength = [...itemSummaries].sort((a, b) => {
      const averageDiff = (b.averageScore ?? 0) - (a.averageScore ?? 0);
      if (averageDiff !== 0) {
        return averageDiff;
      }
      return b.responsesCount - a.responsesCount;
    });

    const sortedByWeakness = [...itemSummaries].sort((a, b) => {
      const averageDiff = (a.averageScore ?? 0) - (b.averageScore ?? 0);
      if (averageDiff !== 0) {
        return averageDiff;
      }
      return b.responsesCount - a.responsesCount;
    });

    const strengths = sortedByStrength.slice(0, 3).map((item) => ({
      ...item,
      insight: summarizeItemStrength(item.averageScore ?? 0),
    }));

    const strengthIds = new Set(strengths.map((item) => item.itemId));
    let weaknesses = sortedByWeakness
      .filter((item) => !strengthIds.has(item.itemId))
      .slice(0, 3);

    if (weaknesses.length === 0 && sortedByWeakness.length > 0) {
      weaknesses = sortedByWeakness.slice(0, Math.min(3, sortedByWeakness.length));
    }

    const discussParticipantCount = new Set(
      discussEntries.map((entry) => entry.author_id),
    ).size;
    const reflectionParticipantCount = new Set(reflections.map((row) => row.user_id)).size;

    const totalReflectionScore = reflections.reduce((sum, row) => sum + row.score, 0);

    return jsonSuccess(
      {
        session: mapSession(sessionData as SessionRow),
        strengths,
        weaknesses: weaknesses.map((item) => ({
          ...item,
          insight: summarizeItemStrength(item.averageScore ?? 0),
        })),
        discussStats: {
          totalEntries: discussEntries.length,
          uniqueParticipants: discussParticipantCount,
          firstEntryAt: discussEntries.length > 0 ? discussEntries[0].created_at : null,
          latestEntryAt:
            discussEntries.length > 0
              ? discussEntries[discussEntries.length - 1].created_at
              : null,
        },
        reflectionStats: {
          totalResponses: reflections.length,
          uniqueParticipants: reflectionParticipantCount,
          overallAverageScore:
            reflections.length > 0
              ? Number((totalReflectionScore / reflections.length).toFixed(2))
              : null,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return unexpectedError("Failed to load review payload", error);
  }
}
