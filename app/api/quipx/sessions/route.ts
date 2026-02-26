import "server-only";

import { z } from "zod";

import {
  databaseError,
  parseBody,
  parseQuery,
  requireDemoActorId,
  unexpectedError,
  validationError,
} from "@/lib/api/route-utils";
import { jsonSuccess } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

const listSessionsQuerySchema = z.object({
  teamId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const createSessionBodySchema = z.object({
  teamId: z.string().uuid(),
  subject: z.string().trim().min(1).max(300),
  objectives: z.string().trim().min(1).max(5000),
  startsAt: z.union([z.string().trim().min(1), z.null()]).optional(),
  durationMin: z
    .preprocess(
      (value) => (value === "" || value === undefined ? null : value),
      z.coerce.number().int().min(0).max(24 * 60).nullable(),
    )
    .optional(),
  status: z.enum(["active", "closed", "archived"]).optional(),
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

function normalizeStartsAt(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return { ok: true as const, value: null };
  }

  const parsed = z
    .object({ startsAt: z.string().datetime({ offset: true }) })
    .safeParse({ startsAt: value });

  if (!parsed.success) {
    return {
      ok: false as const,
      response: validationError("body", parsed.error),
    };
  }

  const timestamp = Date.parse(parsed.data.startsAt);

  return {
    ok: true as const,
    value: new Date(timestamp).toISOString(),
  };
}

export async function GET(request: Request) {
  try {
    const parsedQuery = parseQuery(request, listSessionsQuerySchema);
    if (!parsedQuery.ok) {
      return parsedQuery.response;
    }

    const { teamId, limit } = parsedQuery.data;

    let query = supabaseAdmin
      .from("quipx_sessions")
      .select(
        "id, team_id, creator_id, subject, objectives, starts_at, duration_min, status, created_at",
      )
      .order("created_at", { ascending: false });

    if (teamId) {
      query = query.eq("team_id", teamId);
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      return databaseError("Failed to list Quipx sessions", error);
    }

    const rows = (data ?? []) as SessionRow[];

    return jsonSuccess(
      {
        sessions: rows.map(mapSession),
      },
      { status: 200 },
    );
  } catch (error) {
    return unexpectedError("Failed to list Quipx sessions", error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireDemoActorId(request);
    if (!actor.ok) {
      return actor.response;
    }

    const parsedBody = await parseBody(request, createSessionBodySchema);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const normalizedStartsAt = normalizeStartsAt(parsedBody.data.startsAt);
    if (!normalizedStartsAt.ok) {
      return normalizedStartsAt.response;
    }

    const insertPayload = {
      team_id: parsedBody.data.teamId,
      creator_id: actor.actorId,
      subject: parsedBody.data.subject,
      objectives: parsedBody.data.objectives,
      starts_at: normalizedStartsAt.value,
      duration_min: parsedBody.data.durationMin ?? null,
      status: parsedBody.data.status ?? "active",
    };

    const { data, error } = await supabaseAdmin
      .from("quipx_sessions")
      .insert(insertPayload)
      .select(
        "id, team_id, creator_id, subject, objectives, starts_at, duration_min, status, created_at",
      )
      .single();

    if (error) {
      return databaseError("Failed to create Quipx session", error);
    }

    return jsonSuccess(
      {
        session: mapSession(data as SessionRow),
      },
      { status: 201 },
    );
  } catch (error) {
    return unexpectedError("Failed to create Quipx session", error);
  }
}
