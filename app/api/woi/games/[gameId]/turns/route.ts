import "server-only";

import { z } from "zod";

import { jsonError, jsonSuccess } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  canActorReadGame,
  getGameById,
  getTeamMembersOrdered,
  getUsersByIds,
  isTeamMember,
  jsonDbError,
  requireActorId,
  uniqueIds,
  type UserRow,
} from "@/lib/woi";

const paramsSchema = z.object({
  gameId: z.string().uuid(),
});

const turnsQuerySchema = z.object({
  levelIndex: z.preprocess(
    (value) => (value === null || value === undefined || value === "" ? undefined : value),
    z.coerce.number().int().min(0).max(5).optional(),
  ),
});

const submitTurnSchema = z.object({
  levelIndex: z.preprocess(
    (value) => (value === null || value === undefined || value === "" ? undefined : value),
    z.coerce.number().int().min(0).max(5).optional(),
  ),
  moveId: z.preprocess(
    (value) => (value === null || value === undefined || value === "" ? undefined : value),
    z.string().uuid().optional(),
  ),
  ruleId: z.preprocess(
    (value) => (value === null || value === undefined || value === "" ? undefined : value),
    z.string().uuid().optional(),
  ),
  contentHtml: z.string().trim().min(1).max(20000),
});

type RouteContext = {
  params: Promise<{
    gameId: string;
  }>;
};

type WoiTurnRow = {
  id: string;
  game_id: string;
  level_index: number | null;
  player_id: string;
  move_id: string | null;
  rule_id: string | null;
  content_html: string;
  created_at: string;
};

type TemplateMove = {
  id: string;
  order_index: number;
  move_text: string;
};

type TemplateRule = {
  id: string;
  order_index: number;
  rule_text: string;
};

function mapUsers(users: UserRow[]): Map<string, UserRow> {
  return new Map(users.map((user) => [user.id, user]));
}

async function ensureTemplateMoveBelongsToTemplate(moveId: string, templateId: string) {
  const { count, error } = await supabaseAdmin
    .from("woi_template_moves")
    .select("id", { head: true, count: "exact" })
    .eq("id", moveId)
    .eq("template_id", templateId);

  if (error) {
    return { response: jsonDbError("Failed to validate move", error) };
  }

  if ((count ?? 0) === 0) {
    return {
      response: jsonError("moveId is not part of this game's template", {
        status: 400,
        code: "INVALID_MOVE_ID",
      }),
    };
  }

  return { ok: true as const };
}

async function ensureTemplateRuleBelongsToTemplate(ruleId: string, templateId: string) {
  const { count, error } = await supabaseAdmin
    .from("woi_template_rules")
    .select("id", { head: true, count: "exact" })
    .eq("id", ruleId)
    .eq("template_id", templateId);

  if (error) {
    return { response: jsonDbError("Failed to validate rule", error) };
  }

  if ((count ?? 0) === 0) {
    return {
      response: jsonError("ruleId is not part of this game's template", {
        status: 400,
        code: "INVALID_RULE_ID",
      }),
    };
  }

  return { ok: true as const };
}

export async function GET(request: Request, context: RouteContext) {
  const actor = requireActorId(request);
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

  const query = turnsQuerySchema.safeParse({
    levelIndex: new URL(request.url).searchParams.get("levelIndex"),
  });
  if (!query.success) {
    return jsonError("Invalid query parameters", {
      status: 400,
      code: "INVALID_QUERY",
      details: query.error.flatten(),
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

  const visibility = await canActorReadGame(gameResult.game, actor.actorId);
  if ("response" in visibility) {
    return visibility.response;
  }
  if (!visibility.canRead) {
    return jsonError("You do not have access to this game", {
      status: 403,
      code: "GAME_FORBIDDEN",
    });
  }

  let turnsQueryBuilder = supabaseAdmin
    .from("woi_turns")
    .select("id,game_id,level_index,player_id,move_id,rule_id,content_html,created_at")
    .eq("game_id", gameResult.game.id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (query.data.levelIndex !== undefined) {
    turnsQueryBuilder = turnsQueryBuilder.eq("level_index", query.data.levelIndex);
  }

  const { data: turnsData, error: turnsError } = await turnsQueryBuilder;
  if (turnsError) {
    return jsonDbError("Failed to load turns", turnsError);
  }

  const turns = (turnsData ?? []) as WoiTurnRow[];
  const playerIds = uniqueIds(turns.map((turn) => turn.player_id));
  const moveIds = uniqueIds(turns.map((turn) => turn.move_id));
  const ruleIds = uniqueIds(turns.map((turn) => turn.rule_id));

  const [usersResult, movesResult, rulesResult] = await Promise.all([
    getUsersByIds(playerIds),
    moveIds.length > 0
      ? supabaseAdmin
          .from("woi_template_moves")
          .select("id,order_index,move_text")
          .in("id", moveIds)
      : Promise.resolve({ data: [] as TemplateMove[], error: null }),
    ruleIds.length > 0
      ? supabaseAdmin
          .from("woi_template_rules")
          .select("id,order_index,rule_text")
          .in("id", ruleIds)
      : Promise.resolve({ data: [] as TemplateRule[], error: null }),
  ]);

  if ("response" in usersResult) {
    return usersResult.response;
  }
  if (movesResult.error) {
    return jsonDbError("Failed to load move details", movesResult.error);
  }
  if (rulesResult.error) {
    return jsonDbError("Failed to load rule details", rulesResult.error);
  }

  const usersById = mapUsers(usersResult.users);
  const movesById = new Map(
    ((movesResult.data ?? []) as TemplateMove[]).map((move) => [move.id, move]),
  );
  const rulesById = new Map(
    ((rulesResult.data ?? []) as TemplateRule[]).map((rule) => [rule.id, rule]),
  );

  return jsonSuccess(
    {
      gameId: gameResult.game.id,
      levelIndex: query.data.levelIndex ?? null,
      turns: turns.map((turn) => ({
        ...turn,
        player: usersById.get(turn.player_id) ?? null,
        move: turn.move_id ? (movesById.get(turn.move_id) ?? null) : null,
        rule: turn.rule_id ? (rulesById.get(turn.rule_id) ?? null) : null,
      })),
      count: turns.length,
    },
    { status: 200 },
  );
}

export async function POST(request: Request, context: RouteContext) {
  const actor = requireActorId(request);
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

  const parsedBody = submitTurnSchema.safeParse(body);
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

  if (gameResult.game.status === "finished") {
    return jsonError("Cannot submit turns to a finished game", {
      status: 409,
      code: "GAME_FINISHED",
    });
  }

  const membership = await isTeamMember(gameResult.game.team_id, actor.actorId);
  if ("response" in membership) {
    return membership.response;
  }
  if (!membership.isMember) {
    return jsonError("Only team members can submit turns", {
      status: 403,
      code: "TEAM_FORBIDDEN",
    });
  }

  if (
    gameResult.game.current_player_id &&
    gameResult.game.current_player_id !== actor.actorId
  ) {
    return jsonError("It is not this actor's turn", {
      status: 409,
      code: "NOT_CURRENT_PLAYER",
      details: {
        currentPlayerId: gameResult.game.current_player_id,
      },
    });
  }

  if (parsedBody.data.moveId) {
    const moveValidation = await ensureTemplateMoveBelongsToTemplate(
      parsedBody.data.moveId,
      gameResult.game.template_id,
    );
    if ("response" in moveValidation) {
      return moveValidation.response;
    }
  }

  if (parsedBody.data.ruleId) {
    const ruleValidation = await ensureTemplateRuleBelongsToTemplate(
      parsedBody.data.ruleId,
      gameResult.game.template_id,
    );
    if ("response" in ruleValidation) {
      return ruleValidation.response;
    }
  }

  const { data: insertedTurn, error: insertError } = await supabaseAdmin
    .from("woi_turns")
    .insert({
      game_id: gameResult.game.id,
      level_index: parsedBody.data.levelIndex ?? null,
      player_id: actor.actorId,
      move_id: parsedBody.data.moveId ?? null,
      rule_id: parsedBody.data.ruleId ?? null,
      content_html: parsedBody.data.contentHtml,
    })
    .select("id,game_id,level_index,player_id,move_id,rule_id,content_html,created_at")
    .single();

  if (insertError) {
    return jsonDbError("Failed to submit turn", insertError);
  }

  const membersResult = await getTeamMembersOrdered(gameResult.game.team_id);
  if ("response" in membersResult) {
    return membersResult.response;
  }
  if (membersResult.members.length === 0) {
    return jsonError("Cannot rotate turns because this team has no members", {
      status: 409,
      code: "TEAM_EMPTY",
    });
  }

  const rotationBasePlayerId = gameResult.game.current_player_id ?? actor.actorId;
  let currentIndex = membersResult.members.findIndex(
    (member) => member.user_id === rotationBasePlayerId,
  );
  if (currentIndex < 0) {
    currentIndex = membersResult.members.findIndex(
      (member) => member.user_id === actor.actorId,
    );
  }
  if (currentIndex < 0) {
    return jsonError("Actor is not in team rotation order", {
      status: 409,
      code: "ROTATION_ERROR",
    });
  }

  const nextIndex = (currentIndex + 1) % membersResult.members.length;
  const nextPlayerId = membersResult.members[nextIndex]?.user_id ?? null;

  const { error: rotationError } = await supabaseAdmin
    .from("woi_games")
    .update({
      current_player_id: nextPlayerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", gameResult.game.id);

  if (rotationError) {
    return jsonError("Turn submitted, but failed to rotate current player", {
      status: 500,
      code: "TURN_ROTATION_FAILED",
      details: {
        turnId: insertedTurn.id,
        db: {
          message: rotationError.message,
          code: rotationError.code,
          details: rotationError.details,
          hint: rotationError.hint,
        },
      },
    });
  }

  const usersResult = await getUsersByIds(uniqueIds([actor.actorId, nextPlayerId]));
  if ("response" in usersResult) {
    return usersResult.response;
  }

  const usersById = mapUsers(usersResult.users);

  return jsonSuccess(
    {
      turn: insertedTurn as WoiTurnRow,
      currentPlayerId: nextPlayerId,
      actor: usersById.get(actor.actorId) ?? null,
      nextPlayer: nextPlayerId ? (usersById.get(nextPlayerId) ?? null) : null,
    },
    { status: 201 },
  );
}
