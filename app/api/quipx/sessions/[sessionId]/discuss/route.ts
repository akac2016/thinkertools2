import "server-only";

import { z } from "zod";

import {
  databaseError,
  parseBody,
  parseQuery,
  parseWithSchema,
  requireDemoActorId,
  unexpectedError,
} from "@/lib/api/route-utils";
import { jsonError, jsonSuccess } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

type SessionRow = {
  id: string;
};

type DiscussEntryRow = {
  id: string;
  session_id: string;
  author_id: string;
  body_html: string;
  created_at: string;
};

const sessionParamsSchema = z.object({
  sessionId: z.string().uuid(),
});

const discussQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(300).optional(),
});

const createDiscussEntryBodySchema = z.object({
  bodyHtml: z.string().trim().min(1).max(25_000),
});

function mapDiscussEntry(row: DiscussEntryRow) {
  return {
    id: row.id,
    sessionId: row.session_id,
    authorId: row.author_id,
    bodyHtml: row.body_html,
    createdAt: row.created_at,
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

  return {
    ok: true as const,
    session: data as SessionRow,
  };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const rawParams = await context.params;
    const parsedParams = parseWithSchema(rawParams, sessionParamsSchema, "params");
    if (!parsedParams.ok) {
      return parsedParams.response;
    }

    const parsedQuery = parseQuery(request, discussQuerySchema);
    if (!parsedQuery.ok) {
      return parsedQuery.response;
    }

    const sessionCheck = await ensureSessionExists(parsedParams.data.sessionId);
    if (!sessionCheck.ok) {
      return sessionCheck.response;
    }

    const { sessionId } = parsedParams.data;
    const { limit } = parsedQuery.data;

    let query = supabaseAdmin
      .from("quipx_discuss_entries")
      .select("id, session_id, author_id, body_html, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      return databaseError("Failed to load discussion entries", error);
    }

    const rows = (data ?? []) as DiscussEntryRow[];

    return jsonSuccess(
      {
        sessionId,
        entries: rows.map(mapDiscussEntry),
      },
      { status: 200 },
    );
  } catch (error) {
    return unexpectedError("Failed to load discussion entries", error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = requireDemoActorId(request);
    if (!actor.ok) {
      return actor.response;
    }

    const rawParams = await context.params;
    const parsedParams = parseWithSchema(rawParams, sessionParamsSchema, "params");
    if (!parsedParams.ok) {
      return parsedParams.response;
    }

    const parsedBody = await parseBody(request, createDiscussEntryBodySchema);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const sessionCheck = await ensureSessionExists(parsedParams.data.sessionId);
    if (!sessionCheck.ok) {
      return sessionCheck.response;
    }

    const { data, error } = await supabaseAdmin
      .from("quipx_discuss_entries")
      .insert({
        session_id: parsedParams.data.sessionId,
        author_id: actor.actorId,
        body_html: parsedBody.data.bodyHtml,
      })
      .select("id, session_id, author_id, body_html, created_at")
      .single();

    if (error) {
      return databaseError("Failed to create discussion entry", error);
    }

    return jsonSuccess(
      {
        entry: mapDiscussEntry(data as DiscussEntryRow),
      },
      { status: 201 },
    );
  } catch (error) {
    return unexpectedError("Failed to create discussion entry", error);
  }
}
