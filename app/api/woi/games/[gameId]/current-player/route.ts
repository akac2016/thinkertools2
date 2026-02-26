import "server-only";

import { z } from "zod";

import { jsonError, jsonSuccess } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getGameById,
  getUsersByIds,
  isTeamMember,
  jsonDbError,
  requireActorId,
} from "@/lib/woi";

const paramsSchema = z.object({
  gameId: z.string().uuid(),
});

const overrideBodySchema = z.object({
  playerId: z.string().uuid(),
});

type RouteContext = {
  params: Promise<{
    gameId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const actor = await requireActorId(request);
  if ("response" in actor) {
    return actor.response;
  }

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
    return jsonError("Request body must be valid JSON", {
      status: 400,
      code: "INVALID_JSON",
    });
  }

  const parsedBody = overrideBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("Invalid request body", {
      status: 400,
      code: "INVALID_BODY",
      details: parsedBody.error.flatten(),
    });
  }

  const gameResult = await getGameById(params.data.gameId);
  if ("response" in gameResult) {
    return gameResult.response;
  }
  if (!gameResult.game) {
    return jsonError("Game not found", {
      status: 404,
      code: "GAME_NOT_FOUND",
    });
  }

  if (gameResult.game.creator_id !== actor.actorId) {
    return jsonError("Only the game creator can override current player", {
      status: 403,
      code: "CREATOR_ONLY",
    });
  }

  const membership = await isTeamMember(gameResult.game.team_id, parsedBody.data.playerId);
  if ("response" in membership) {
    return membership.response;
  }
  if (!membership.isMember) {
    return jsonError("playerId must be a member of the game team", {
      status: 400,
      code: "INVALID_PLAYER_ID",
    });
  }

  const previousPlayerId = gameResult.game.current_player_id;

  const { error: updateError } = await supabaseAdmin
    .from("woi_games")
    .update({
      current_player_id: parsedBody.data.playerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", gameResult.game.id);

  if (updateError) {
    return jsonDbError("Failed to update current player", updateError);
  }

  const usersResult = await getUsersByIds(
    [actor.actorId, previousPlayerId, parsedBody.data.playerId].filter(
      (value): value is string => Boolean(value),
    ),
  );
  if ("response" in usersResult) {
    return usersResult.response;
  }

  const usersById = new Map(usersResult.users.map((user) => [user.id, user]));

  return jsonSuccess(
    {
      gameId: gameResult.game.id,
      actorId: actor.actorId,
      actor: usersById.get(actor.actorId) ?? null,
      previousPlayerId,
      previousPlayer: previousPlayerId ? (usersById.get(previousPlayerId) ?? null) : null,
      currentPlayerId: parsedBody.data.playerId,
      currentPlayer: usersById.get(parsedBody.data.playerId) ?? null,
    },
    { status: 200 },
  );
}
