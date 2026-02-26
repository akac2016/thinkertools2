import "server-only";

import { z } from "zod";

import { jsonError, jsonSuccess } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  WOI_GAME_SELECT_COLUMNS,
  getTeamMembersOrdered,
  getUsersByIds,
  isTeamMember,
  jsonDbError,
  requireActorId,
  uniqueIds,
  type UserRow,
  type WoiGameRow,
} from "@/lib/woi";

const teamQuerySchema = z.object({
  teamId: z.string().uuid(),
});

const createGameSchema = z.object({
  templateId: z.string().uuid(),
  teamId: z.string().uuid(),
  question: z.string().trim().min(1).max(2000),
  description: z.string().trim().min(1).max(8000),
  isPublic: z.boolean().optional().default(false),
});

type TemplateSummary = {
  id: string;
  name: string;
  category: "structural" | "functional" | "process" | "uncategorized";
};

async function ensureActorCanAccessTeam(teamId: string, actorId: string) {
  const membership = await isTeamMember(teamId, actorId);
  if ("response" in membership) {
    return membership;
  }

  if (membership.isMember) {
    return { ok: true as const };
  }

  const { count, error } = await supabaseAdmin
    .from("teams")
    .select("id", { head: true, count: "exact" })
    .eq("id", teamId);

  if (error) {
    return { response: jsonDbError("Failed to verify team", error) };
  }

  if ((count ?? 0) === 0) {
    return {
      response: jsonError("Team not found", {
        status: 404,
        code: "TEAM_NOT_FOUND",
      }),
    };
  }

  return {
    response: jsonError("You are not a member of this team", {
      status: 403,
      code: "TEAM_FORBIDDEN",
    }),
  };
}

function mapUserById(users: UserRow[]): Map<string, UserRow> {
  return new Map(users.map((user) => [user.id, user]));
}

export async function GET(request: Request) {
  const actor = await requireActorId(request);
  if ("response" in actor) {
    return actor.response;
  }

  const parsedQuery = teamQuerySchema.safeParse({
    teamId: new URL(request.url).searchParams.get("teamId"),
  });

  if (!parsedQuery.success) {
    return jsonError("Invalid query parameters", {
      status: 400,
      code: "INVALID_QUERY",
      details: parsedQuery.error.flatten(),
    });
  }

  const teamAccess = await ensureActorCanAccessTeam(parsedQuery.data.teamId, actor.actorId);
  if ("response" in teamAccess) {
    return teamAccess.response;
  }

  const { data: gamesData, error: gamesError } = await supabaseAdmin
    .from("woi_games")
    .select(WOI_GAME_SELECT_COLUMNS)
    .eq("team_id", parsedQuery.data.teamId)
    .order("updated_at", { ascending: false });

  if (gamesError) {
    return jsonDbError("Failed to load games", gamesError);
  }

  const games = (gamesData ?? []) as WoiGameRow[];
  const templateIds = uniqueIds(games.map((game) => game.template_id));
  const userIds = uniqueIds(
    games.flatMap((game) => [game.creator_id, game.current_player_id]),
  );

  let templatesById = new Map<string, TemplateSummary>();
  if (templateIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("woi_templates")
      .select("id,name,category")
      .in("id", templateIds);

    if (error) {
      return jsonDbError("Failed to load game templates", error);
    }

    templatesById = new Map(
      ((data ?? []) as TemplateSummary[]).map((template) => [template.id, template]),
    );
  }

  const usersResult = await getUsersByIds(userIds);
  if ("response" in usersResult) {
    return usersResult.response;
  }

  const usersById = mapUserById(usersResult.users);

  return jsonSuccess(
    {
      teamId: parsedQuery.data.teamId,
      games: games.map((game) => ({
        ...game,
        template: templatesById.get(game.template_id) ?? null,
        creator: usersById.get(game.creator_id) ?? null,
        currentPlayer: game.current_player_id
          ? (usersById.get(game.current_player_id) ?? null)
          : null,
      })),
    },
    { status: 200 },
  );
}

export async function POST(request: Request) {
  const actor = await requireActorId(request);
  if ("response" in actor) {
    return actor.response;
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

  const parsedBody = createGameSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("Invalid request body", {
      status: 400,
      code: "INVALID_BODY",
      details: parsedBody.error.flatten(),
    });
  }

  const teamAccess = await ensureActorCanAccessTeam(parsedBody.data.teamId, actor.actorId);
  if ("response" in teamAccess) {
    return teamAccess.response;
  }

  const { data: template, error: templateError } = await supabaseAdmin
    .from("woi_templates")
    .select("id,creator_id,is_public,name,objective,category")
    .eq("id", parsedBody.data.templateId)
    .maybeSingle();

  if (templateError) {
    return jsonDbError("Failed to load template", templateError);
  }

  if (!template) {
    return jsonError("Template not found", {
      status: 404,
      code: "TEMPLATE_NOT_FOUND",
    });
  }

  if (!template.is_public && template.creator_id !== actor.actorId) {
    return jsonError("Template is private and unavailable to this actor", {
      status: 403,
      code: "TEMPLATE_FORBIDDEN",
    });
  }

  const membersResult = await getTeamMembersOrdered(parsedBody.data.teamId);
  if ("response" in membersResult) {
    return membersResult.response;
  }

  if (membersResult.members.length === 0) {
    return jsonError("Cannot create a game for a team with no members", {
      status: 409,
      code: "TEAM_EMPTY",
    });
  }

  const initialCurrentPlayerId = membersResult.members[0]?.user_id ?? null;

  const { data: createdGame, error: createError } = await supabaseAdmin
    .from("woi_games")
    .insert({
      template_id: parsedBody.data.templateId,
      team_id: parsedBody.data.teamId,
      creator_id: actor.actorId,
      question: parsedBody.data.question,
      description: parsedBody.data.description,
      is_public: parsedBody.data.isPublic,
      status: "in_play",
      current_player_id: initialCurrentPlayerId,
    })
    .select(WOI_GAME_SELECT_COLUMNS)
    .single();

  if (createError) {
    return jsonDbError("Failed to create game", createError);
  }

  return jsonSuccess(
    {
      game: createdGame as WoiGameRow,
      template,
      initialCurrentPlayerId,
    },
    { status: 201 },
  );
}
