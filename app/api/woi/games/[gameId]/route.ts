import "server-only";

import { z } from "zod";

import { jsonError, jsonSuccess } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  canActorReadGame,
  getGameById,
  getTeamMembersOrdered,
  getUsersByIds,
  jsonDbError,
  requireActorId,
  uniqueIds,
  type TeamMemberRow,
  type UserRow,
} from "@/lib/woi";

const paramsSchema = z.object({
  gameId: z.string().uuid(),
});

type RouteContext = {
  params: Promise<{
    gameId: string;
  }>;
};

type TemplateRow = {
  id: string;
  creator_id: string;
  name: string;
  objective: string;
  category: "structural" | "functional" | "process" | "uncategorized";
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

type TemplateRule = {
  id: string;
  order_index: number;
  rule_text: string;
};

type TemplateMove = {
  id: string;
  order_index: number;
  move_text: string;
};

type TemplateLevel = {
  id: string;
  order_index: number;
  level_name: string;
  level_objective: string;
};

function mapUsers(users: UserRow[]): Map<string, UserRow> {
  return new Map(users.map((user) => [user.id, user]));
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

  const [
    templateResult,
    rulesResult,
    movesResult,
    levelsResult,
    membersResult,
    turnsCountResult,
    teamResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("woi_templates")
      .select("id,creator_id,name,objective,category,is_public,created_at,updated_at")
      .eq("id", gameResult.game.template_id)
      .maybeSingle(),
    supabaseAdmin
      .from("woi_template_rules")
      .select("id,order_index,rule_text")
      .eq("template_id", gameResult.game.template_id)
      .order("order_index", { ascending: true }),
    supabaseAdmin
      .from("woi_template_moves")
      .select("id,order_index,move_text")
      .eq("template_id", gameResult.game.template_id)
      .order("order_index", { ascending: true }),
    supabaseAdmin
      .from("woi_template_levels")
      .select("id,order_index,level_name,level_objective")
      .eq("template_id", gameResult.game.template_id)
      .order("order_index", { ascending: true }),
    getTeamMembersOrdered(gameResult.game.team_id),
    supabaseAdmin
      .from("woi_turns")
      .select("id", { head: true, count: "exact" })
      .eq("game_id", gameResult.game.id),
    supabaseAdmin.from("teams").select("id,name,created_at").eq("id", gameResult.game.team_id).maybeSingle(),
  ]);

  if (templateResult.error) {
    return jsonDbError("Failed to load game template", templateResult.error);
  }
  if (!templateResult.data) {
    return jsonError("Template referenced by this game was not found", {
      status: 404,
      code: "TEMPLATE_NOT_FOUND",
    });
  }

  if (rulesResult.error) {
    return jsonDbError("Failed to load template rules", rulesResult.error);
  }
  if (movesResult.error) {
    return jsonDbError("Failed to load template moves", movesResult.error);
  }
  if (levelsResult.error) {
    return jsonDbError("Failed to load template levels", levelsResult.error);
  }
  if ("response" in membersResult) {
    return membersResult.response;
  }
  if (turnsCountResult.error) {
    return jsonDbError("Failed to load turn count", turnsCountResult.error);
  }
  if (teamResult.error) {
    return jsonDbError("Failed to load team details", teamResult.error);
  }

  const memberUserIds = membersResult.members.map((member) => member.user_id);
  const usersResult = await getUsersByIds(
    uniqueIds([
      ...memberUserIds,
      gameResult.game.creator_id,
      gameResult.game.current_player_id,
      templateResult.data.creator_id,
    ]),
  );
  if ("response" in usersResult) {
    return usersResult.response;
  }

  const usersById = mapUsers(usersResult.users);
  const membersWithUsers = membersResult.members.map((member: TeamMemberRow) => ({
    ...member,
    user: usersById.get(member.user_id) ?? null,
  }));

  return jsonSuccess(
    {
      game: {
        ...gameResult.game,
        creator: usersById.get(gameResult.game.creator_id) ?? null,
        currentPlayer: gameResult.game.current_player_id
          ? (usersById.get(gameResult.game.current_player_id) ?? null)
          : null,
      },
      template: {
        ...(templateResult.data as TemplateRow),
        creator: usersById.get(templateResult.data.creator_id) ?? null,
        rules: (rulesResult.data ?? []) as TemplateRule[],
        moves: (movesResult.data ?? []) as TemplateMove[],
        levels: (levelsResult.data ?? []) as TemplateLevel[],
      },
      team: {
        ...(teamResult.data ?? { id: gameResult.game.team_id, name: null, created_at: null }),
        members: membersWithUsers,
      },
      turnsCount: turnsCountResult.count ?? 0,
    },
    { status: 200 },
  );
}
