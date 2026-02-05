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

type UserRow = {
  id: string;
  name: string;
  color: string;
};

type DiscussRow = {
  author_id: string;
  created_at: string;
};

type ReflectionRow = {
  user_id: string;
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

    const session = sessionData as SessionRow;

    const [creatorResult, discussResult, reflectionResult] = await Promise.all([
      supabaseAdmin
        .from("users")
        .select("id, name, color")
        .eq("id", session.creator_id)
        .maybeSingle(),
      supabaseAdmin
        .from("quipx_discuss_entries")
        .select("author_id, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("quipx_reflections")
        .select("user_id")
        .eq("session_id", sessionId),
    ]);

    if (creatorResult.error) {
      return databaseError("Failed to load session creator", creatorResult.error);
    }

    if (discussResult.error) {
      return databaseError("Failed to load discussion stats", discussResult.error);
    }

    if (reflectionResult.error) {
      return databaseError("Failed to load reflection stats", reflectionResult.error);
    }

    const discussRows = (discussResult.data ?? []) as DiscussRow[];
    const reflectionRows = (reflectionResult.data ?? []) as ReflectionRow[];

    const discussParticipantCount = new Set(discussRows.map((entry) => entry.author_id)).size;
    const reflectionParticipantCount = new Set(
      reflectionRows.map((entry) => entry.user_id),
    ).size;

    const firstDiscussAt = discussRows.length > 0 ? discussRows[0].created_at : null;
    const lastDiscussAt =
      discussRows.length > 0 ? discussRows[discussRows.length - 1].created_at : null;

    return jsonSuccess(
      {
        session: mapSession(session),
        creator: creatorResult.data ? (creatorResult.data as UserRow) : null,
        stats: {
          discussEntries: discussRows.length,
          discussParticipantCount,
          firstDiscussAt,
          lastDiscussAt,
          reflectionResponses: reflectionRows.length,
          reflectionParticipantCount,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return unexpectedError("Failed to load Quipx session", error);
  }
}
