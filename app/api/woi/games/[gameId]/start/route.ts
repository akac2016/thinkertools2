import "server-only";

import { z } from "zod";

import { jsonError, jsonSuccess } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  resolveManualStartTransition,
  type LobbyRuleSlot,
} from "@/lib/woi-lobby-rules";
import {
  WOI_GAME_SELECT_COLUMNS,
  getGameById,
  jsonDbError,
  requireActorId,
  type WoiGameSlotRow,
} from "@/lib/woi";

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

function toLobbyRuleSlots(slots: WoiGameSlotRow[]): LobbyRuleSlot[] {
  return slots.map((slot) => ({
    slotIndex: slot.slot_index,
    seatType: slot.seat_type,
    state: slot.state,
    assignedUserId: slot.assigned_user_id,
  }));
}

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

  if (gameResult.game.creator_id !== actor.actorId) {
    return jsonError("Only the game creator can start the game", {
      status: 403,
      code: "CREATOR_ONLY",
    });
  }

  if (gameResult.game.status !== "lobby") {
    return jsonError("Game is not in lobby status", {
      status: 409,
      code: "GAME_NOT_IN_LOBBY",
      details: {
        status: gameResult.game.status,
      },
    });
  }

  if (gameResult.game.seat_claims_locked) {
    return jsonError("Player claims are already locked", {
      status: 409,
      code: "PLAYER_CLAIMS_LOCKED",
    });
  }

  const { data: slotsData, error: slotsError } = await supabaseAdmin
    .from("woi_game_slots")
    .select("id,game_id,slot_index,seat_type,state,assigned_user_id,ai_profile,created_at,updated_at")
    .eq("game_id", gameResult.game.id)
    .order("slot_index", { ascending: true });

  if (slotsError) {
    return jsonDbError("Failed to load game slots", slotsError);
  }

  const slots = (slotsData ?? []) as WoiGameSlotRow[];
  if (slots.length === 0) {
    return jsonError("Game slots are unavailable for this game", {
      status: 409,
      code: "GAME_SLOTS_UNAVAILABLE",
    });
  }

  const transition = resolveManualStartTransition({
    status: gameResult.game.status,
    seatClaimsLocked: gameResult.game.seat_claims_locked,
    slots: toLobbyRuleSlots(slots),
    currentPlayerId: gameResult.game.current_player_id,
  });
  if (!transition.ok) {
    if (transition.code === "PLAYER_SEATS_UNFILLED") {
      return jsonError("All player seats must be filled before starting", {
        status: 409,
        code: transition.code,
      });
    }
    if (transition.code === "PLAYER_CLAIMS_LOCKED") {
      return jsonError("Player claims are already locked", {
        status: 409,
        code: transition.code,
      });
    }
    return jsonError("Game is not in lobby status", {
      status: 409,
      code: transition.code,
      details: {
        status: gameResult.game.status,
      },
    });
  }

  const updateTimestamp = nowIso();
  const { data: startedGame, error: startError } = await supabaseAdmin
    .from("woi_games")
    .update({
      status: transition.status,
      seat_claims_locked: transition.seatClaimsLocked,
      current_player_id: transition.currentPlayerId,
      updated_at: updateTimestamp,
    })
    .eq("id", gameResult.game.id)
    .eq("creator_id", actor.actorId)
    .eq("status", "lobby")
    .eq("seat_claims_locked", false)
    .select(WOI_GAME_SELECT_COLUMNS)
    .maybeSingle();

  if (startError) {
    return jsonDbError("Failed to start game", startError);
  }
  if (!startedGame) {
    return jsonError("Game could not be started", {
      status: 409,
      code: "GAME_START_CONFLICT",
    });
  }

  const { error: lockSlotsError } = await supabaseAdmin
    .from("woi_game_slots")
    .update({
      state: "locked",
      updated_at: updateTimestamp,
    })
    .eq("game_id", gameResult.game.id)
    .eq("seat_type", "human")
    .in("state", ["open", "released", "invited"]);

  if (lockSlotsError) {
    return jsonDbError("Game started, but failed to lock unfilled seats", lockSlotsError);
  }

  return jsonSuccess(
    {
      game: startedGame,
      startedAt: updateTimestamp,
    },
    { status: 200 },
  );
}
