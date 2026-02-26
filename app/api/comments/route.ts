import "server-only";

import { z } from "zod";

import {
  databaseError,
  parseBody,
  parseQuery,
  requireDemoActorId,
  unexpectedError,
} from "@/lib/api/route-utils";
import { jsonSuccess } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";

type CommentRow = {
  id: string;
  context_type: "quipx_session" | "woi_game";
  context_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

const contextTypeSchema = z.enum(["quipx_session", "woi_game"]);

const listCommentsQuerySchema = z.object({
  contextType: contextTypeSchema,
  contextId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const createCommentBodySchema = z.object({
  contextType: contextTypeSchema,
  contextId: z.string().uuid(),
  body: z.string().trim().min(1).max(5_000),
});

function mapComment(row: CommentRow) {
  return {
    id: row.id,
    contextType: row.context_type,
    contextId: row.context_id,
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at,
  };
}

export async function GET(request: Request) {
  try {
    const parsedQuery = parseQuery(request, listCommentsQuerySchema);
    if (!parsedQuery.ok) {
      return parsedQuery.response;
    }

    const { contextType, contextId, limit } = parsedQuery.data;

    let query = supabaseAdmin
      .from("comments")
      .select("id, context_type, context_id, author_id, body, created_at")
      .eq("context_type", contextType)
      .eq("context_id", contextId)
      .order("created_at", { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      return databaseError("Failed to load comments", error);
    }

    const rows = (data ?? []) as CommentRow[];

    return jsonSuccess(
      {
        comments: rows.map(mapComment),
      },
      { status: 200 },
    );
  } catch (error) {
    return unexpectedError("Failed to load comments", error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireDemoActorId(request);
    if (!actor.ok) {
      return actor.response;
    }

    const parsedBody = await parseBody(request, createCommentBodySchema);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { data, error } = await supabaseAdmin
      .from("comments")
      .insert({
        context_type: parsedBody.data.contextType,
        context_id: parsedBody.data.contextId,
        author_id: actor.actorId,
        body: parsedBody.data.body,
      })
      .select("id, context_type, context_id, author_id, body, created_at")
      .single();

    if (error) {
      return databaseError("Failed to create comment", error);
    }

    return jsonSuccess(
      {
        comment: mapComment(data as CommentRow),
      },
      { status: 201 },
    );
  } catch (error) {
    return unexpectedError("Failed to create comment", error);
  }
}
