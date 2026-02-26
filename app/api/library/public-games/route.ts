import "server-only";

import { z } from "zod";

import { jsonError, jsonSuccess } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  WOI_GAME_SELECT_COLUMNS,
  getUsersByIds,
  jsonDbError,
  uniqueIds,
  type UserRow,
  type WoiGameRow,
} from "@/lib/woi";

const querySchema = z.object({
  q: z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : undefined),
    z.string().min(1).max(200).optional(),
  ),
  limit: z.preprocess(
    (value) => (value === null || value === undefined || value === "" ? 25 : value),
    z.coerce.number().int().min(1).max(100),
  ),
});

type TemplateSummary = {
  id: string;
  name: string;
  objective: string;
  category: "structural" | "functional" | "process" | "uncategorized";
};

type TeamSummary = {
  id: string;
  name: string;
};

function mapUsers(users: UserRow[]): Map<string, UserRow> {
  return new Map(users.map((user) => [user.id, user]));
}

export async function GET(request: Request) {
  const parsedQuery = querySchema.safeParse({
    q: new URL(request.url).searchParams.get("q"),
    limit: new URL(request.url).searchParams.get("limit"),
  });

  if (!parsedQuery.success) {
    return jsonError("Invalid query parameters", {
      status: 400,
      code: "INVALID_QUERY",
      details: parsedQuery.error.flatten(),
    });
  }

  const requestedLimit = parsedQuery.data.limit;
  const hasSearch = Boolean(parsedQuery.data.q);
  const preFilterLimit = hasSearch ? Math.min(requestedLimit * 5, 200) : requestedLimit;

  const { data: gamesData, error: gamesError } = await supabaseAdmin
    .from("woi_games")
    .select(WOI_GAME_SELECT_COLUMNS)
    .eq("is_public", true)
    .order("updated_at", { ascending: false })
    .limit(preFilterLimit);

  if (gamesError) {
    return jsonDbError("Failed to load public games", gamesError);
  }

  const games = (gamesData ?? []) as WoiGameRow[];
  const templateIds = uniqueIds(games.map((game) => game.template_id));
  const teamIds = uniqueIds(games.map((game) => game.team_id));
  const userIds = uniqueIds(
    games.flatMap((game) => [game.creator_id, game.current_player_id]),
  );

  const [templatesResult, teamsResult, usersResult] = await Promise.all([
    templateIds.length > 0
      ? supabaseAdmin
          .from("woi_templates")
          .select("id,name,objective,category")
          .in("id", templateIds)
      : Promise.resolve({ data: [] as TemplateSummary[], error: null }),
    teamIds.length > 0
      ? supabaseAdmin.from("teams").select("id,name").in("id", teamIds)
      : Promise.resolve({ data: [] as TeamSummary[], error: null }),
    getUsersByIds(userIds),
  ]);

  if (templatesResult.error) {
    return jsonDbError("Failed to load template summaries", templatesResult.error);
  }
  if (teamsResult.error) {
    return jsonDbError("Failed to load team summaries", teamsResult.error);
  }
  if ("response" in usersResult) {
    return usersResult.response;
  }

  const templatesById = new Map(
    ((templatesResult.data ?? []) as TemplateSummary[]).map((template) => [template.id, template]),
  );
  const teamsById = new Map(
    ((teamsResult.data ?? []) as TeamSummary[]).map((team) => [team.id, team]),
  );
  const usersById = mapUsers(usersResult.users);

  const enrichedGames = games.map((game) => ({
    ...game,
    template: templatesById.get(game.template_id) ?? null,
    team: teamsById.get(game.team_id) ?? null,
    creator: usersById.get(game.creator_id) ?? null,
    currentPlayer: game.current_player_id
      ? (usersById.get(game.current_player_id) ?? null)
      : null,
  }));

  const needle = parsedQuery.data.q?.toLowerCase() ?? null;
  const filtered = needle
    ? enrichedGames.filter((game) => {
        const haystack = [
          game.question,
          game.description,
          game.template?.name ?? "",
          game.template?.objective ?? "",
          game.team?.name ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      })
    : enrichedGames;

  return jsonSuccess(
    {
      query: parsedQuery.data.q ?? null,
      count: Math.min(filtered.length, requestedLimit),
      games: filtered.slice(0, requestedLimit),
    },
    { status: 200 },
  );
}
