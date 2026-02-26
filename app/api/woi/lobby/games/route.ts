import "server-only";

import { getOptionalActorIdFromRequest } from "@/lib/auth/actor";
import { jsonSuccess } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  WOI_GAME_SELECT_COLUMNS,
  getUsersByIds,
  jsonDbError,
  uniqueIds,
  type WoiGameRow,
} from "@/lib/woi";

type TemplateRow = {
  id: string;
  name: string;
  category: "structural" | "functional" | "process" | "uncategorized";
};

type SlotCountRow = {
  game_id: string;
};

type FilledSeatRow = {
  game_id: string;
};

export async function GET(request: Request) {
  const actorId = await getOptionalActorIdFromRequest(request);

  const { data: openSeatRows, error: openSeatError } = await supabaseAdmin
    .from("woi_game_slots")
    .select("game_id")
    .eq("seat_type", "human")
    .in("state", ["open", "released"]);

  if (openSeatError) {
    return jsonDbError("Failed to load lobby game seats", openSeatError);
  }

  const openSeatCounts = new Map<string, number>();
  for (const row of (openSeatRows ?? []) as SlotCountRow[]) {
    openSeatCounts.set(row.game_id, (openSeatCounts.get(row.game_id) ?? 0) + 1);
  }

  const gameIdsWithOpenSeats = Array.from(openSeatCounts.keys());
  if (gameIdsWithOpenSeats.length === 0) {
    return jsonSuccess({ games: [] }, { status: 200 });
  }

  const { data: gameRows, error: gamesError } = await supabaseAdmin
    .from("woi_games")
    .select(WOI_GAME_SELECT_COLUMNS)
    .in("id", gameIdsWithOpenSeats)
    .eq("status", "lobby")
    .eq("lobby_visibility", "listed")
    .order("updated_at", { ascending: false });

  if (gamesError) {
    return jsonDbError("Failed to load lobby games", gamesError);
  }

  const games = (gameRows ?? []) as WoiGameRow[];
  if (games.length === 0) {
    return jsonSuccess({ games: [] }, { status: 200 });
  }

  const templateIds = uniqueIds(games.map((game) => game.template_id));
  const userIds = uniqueIds(games.map((game) => game.creator_id));

  let templatesById = new Map<string, TemplateRow>();
  if (templateIds.length > 0) {
    const { data: templateRows, error: templateError } = await supabaseAdmin
      .from("woi_templates")
      .select("id,name,category")
      .in("id", templateIds);

    if (templateError) {
      return jsonDbError("Failed to load lobby game templates", templateError);
    }

    templatesById = new Map(
      ((templateRows ?? []) as TemplateRow[]).map((template) => [template.id, template]),
    );
  }

  const usersResult = await getUsersByIds(userIds);
  if ("response" in usersResult) {
    return usersResult.response;
  }
  const usersById = new Map(usersResult.users.map((user) => [user.id, user]));

  let filledSeatGameIds = new Set<string>();
  if (actorId) {
    const { data: filledRows, error: filledError } = await supabaseAdmin
      .from("woi_game_slots")
      .select("game_id")
      .eq("seat_type", "human")
      .eq("state", "filled")
      .eq("assigned_user_id", actorId)
      .in(
        "game_id",
        games.map((game) => game.id),
      );

    if (filledError) {
      return jsonDbError("Failed to verify player seat assignments", filledError);
    }

    filledSeatGameIds = new Set(
      ((filledRows ?? []) as FilledSeatRow[]).map((row) => row.game_id),
    );
  }

  return jsonSuccess(
    {
      games: games.map((game) => ({
        id: game.id,
        question: game.question,
        description: game.description,
        status: game.status,
        updatedAt: game.updated_at,
        openHumanSeats: openSeatCounts.get(game.id) ?? 0,
        seatClaimsLocked: game.seat_claims_locked || game.status !== "lobby",
        joinLinkEnabled: game.join_link_enabled,
        creator: usersById.get(game.creator_id) ?? null,
        template: templatesById.get(game.template_id) ?? null,
        alreadyJoinedAsPlayer: actorId ? filledSeatGameIds.has(game.id) : false,
      })),
    },
    { status: 200 },
  );
}
