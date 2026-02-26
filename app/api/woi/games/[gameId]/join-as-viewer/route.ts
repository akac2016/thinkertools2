import "server-only";

import { z } from "zod";

import { getOptionalActorIdFromRequest } from "@/lib/auth/actor";
import { jsonError, jsonSuccess } from "@/lib/http";
import { joinViewerSession } from "@/lib/woi-lobby";
import { isViewerJoinAllowedForStatus } from "@/lib/woi-lobby-rules";
import {
  canAccessGame,
  getGameById,
  getWoiAnonSessionIdFromRequest,
  type WoiViewerSource,
} from "@/lib/woi";

const paramsSchema = z.object({
  gameId: z.string().uuid(),
});

const bodySchema = z
  .object({
    source: z.enum(["lobby", "join_link", "public_url", "manual"]).optional(),
  })
  .strict();

type RouteContext = {
  params: Promise<{
    gameId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) {
    return jsonError("Invalid game id", {
      status: 400,
      code: "INVALID_GAME_ID",
      details: params.error.flatten(),
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsedBody = bodySchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("Invalid request body", {
      status: 400,
      code: "INVALID_BODY",
      details: parsedBody.error.flatten(),
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

  if (!isViewerJoinAllowedForStatus(gameResult.game.status)) {
    return jsonError("Viewer access is unavailable for this game status", {
      status: 409,
      code: "VIEWER_JOIN_UNAVAILABLE",
      details: {
        status: gameResult.game.status,
      },
    });
  }

  const anonSessionId = getWoiAnonSessionIdFromRequest(request);
  const access = await canAccessGame(gameResult.game, {
    actorId,
    anonSessionId,
  });
  if ("response" in access) {
    return access.response;
  }
  if (!access.canRead) {
    return jsonError("You do not have access to this game", {
      status: 403,
      code: "GAME_FORBIDDEN",
    });
  }

  const source = (parsedBody.data.source ?? "manual") as WoiViewerSource;

  const joinResult = await joinViewerSession({
    gameId: gameResult.game.id,
    source,
    actorId,
    anonSessionId,
  });
  if (!joinResult.ok) {
    return joinResult.response;
  }

  return jsonSuccess(
    {
      gameId: gameResult.game.id,
      viewer: joinResult.viewer,
      wasExistingSession: joinResult.wasExistingSession,
      anonSessionId: joinResult.anonSessionId,
    },
    { status: 200 },
  );
}
