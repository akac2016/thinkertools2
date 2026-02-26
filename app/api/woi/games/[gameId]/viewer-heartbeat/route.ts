import "server-only";

import { z } from "zod";

import { getOptionalActorIdFromRequest } from "@/lib/auth/actor";
import { jsonError, jsonSuccess } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getGameById, getWoiAnonSessionIdFromRequest, jsonDbError } from "@/lib/woi";

const paramsSchema = z.object({
  gameId: z.string().uuid(),
});

type RouteContext = {
  params: Promise<{
    gameId: string;
  }>;
};

function nowIso() {
  return new Date().toISOString();
}

export async function POST(request: Request, context: RouteContext) {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) {
    return jsonError("Invalid game id", {
      status: 400,
      code: "INVALID_GAME_ID",
      details: params.error.flatten(),
    });
  }

  const [actorId, gameResult] = await Promise.all([
    getOptionalActorIdFromRequest(request),
    getGameById(params.data.gameId),
  ]);

  if ("response" in gameResult) {
    return gameResult.response;
  }
  if (!gameResult.game) {
    return jsonError("Game not found", {
      status: 404,
      code: "GAME_NOT_FOUND",
    });
  }

  const anonSessionId = actorId ? null : getWoiAnonSessionIdFromRequest(request);
  if (!actorId && !anonSessionId) {
    return jsonError("Viewer identity is required", {
      status: 401,
      code: "VIEWER_IDENTITY_REQUIRED",
      details: {
        headers: ["authorization", "x-demo-user-id", "x-woi-anon-session-id"],
      },
    });
  }

  const heartbeatAt = nowIso();
  let heartbeatQuery = supabaseAdmin
    .from("woi_game_viewers")
    .update({
      last_seen_at: heartbeatAt,
      left_at: null,
    })
    .eq("game_id", gameResult.game.id)
    .is("left_at", null);

  if (actorId) {
    heartbeatQuery = heartbeatQuery.eq("user_id", actorId);
  } else {
    heartbeatQuery = heartbeatQuery.eq("anon_session_id", anonSessionId ?? "");
  }

  const { data: refreshedRows, error: heartbeatError } = await heartbeatQuery
    .select("id,game_id,user_id,anon_session_id,source,joined_at,last_seen_at,left_at")
    .limit(1);

  if (heartbeatError) {
    return jsonDbError("Failed to refresh viewer heartbeat", heartbeatError);
  }

  const refreshed = refreshedRows?.[0];
  if (!refreshed) {
    return jsonError("Viewer session not found", {
      status: 404,
      code: "VIEWER_SESSION_NOT_FOUND",
    });
  }

  return jsonSuccess(
    {
      gameId: gameResult.game.id,
      heartbeatAt,
      viewer: refreshed,
    },
    { status: 200 },
  );
}
