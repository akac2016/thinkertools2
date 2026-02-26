import "server-only";

import { z } from "zod";

import { claimOpenHumanSeat } from "@/lib/woi-lobby";
import { jsonError, jsonSuccess } from "@/lib/http";
import { canActorReadGame, getGameById, requireActorId } from "@/lib/woi";

const paramsSchema = z.object({
  gameId: z.string().uuid(),
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

  const access = await canActorReadGame(gameResult.game, actor.actorId);
  if ("response" in access) {
    return access.response;
  }
  if (!access.canRead) {
    return jsonError("You do not have access to this game", {
      status: 403,
      code: "GAME_FORBIDDEN",
    });
  }

  const claimResult = await claimOpenHumanSeat(gameResult.game, actor.actorId);
  if (!claimResult.ok) {
    return claimResult.response;
  }

  return jsonSuccess(
    {
      gameId: gameResult.game.id,
      slot: claimResult.slot,
      alreadyClaimed: claimResult.alreadyClaimed,
      remainingOpenHumanSeats: claimResult.remainingOpenHumanSeats,
    },
    { status: 200 },
  );
}
