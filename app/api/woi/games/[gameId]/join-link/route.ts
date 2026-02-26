import "server-only";

import { randomBytes } from "crypto";
import { z } from "zod";

import { jsonError, jsonSuccess } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hashJoinToken } from "@/lib/woi-lobby";
import { getGameById, jsonDbError, requireActorId, type WoiGameJoinLinkRow } from "@/lib/woi";

const paramsSchema = z.object({
  gameId: z.string().uuid(),
});

const postBodySchema = z
  .object({
    action: z.enum(["create", "rotate", "revoke"]),
    maxClaims: z.preprocess(
      (value) => (value === null || value === undefined || value === "" ? null : value),
      z.number().int().positive().max(100000).nullable().optional(),
    ),
    expiresAt: z.preprocess(
      (value) => {
        if (value === null || value === undefined) {
          return null;
        }
        if (typeof value === "string" && value.trim().length === 0) {
          return null;
        }
        return value;
      },
      z.string().datetime({ offset: true }).nullable().optional(),
    ),
  })
  .strict();

type RouteContext = {
  params: Promise<{
    gameId: string;
  }>;
};

function nowIso() {
  return new Date().toISOString();
}

function buildShareUrl(request: Request, gameId: string, token: string) {
  const origin = new URL(request.url).origin;
  return `${origin}/woi/join/${gameId}?token=${encodeURIComponent(token)}`;
}

async function loadActiveJoinLinks(gameId: string) {
  const { data, error } = await supabaseAdmin
    .from("woi_game_join_links")
    .select("id,game_id,token_hash,status,max_claims,claims_count,expires_at,created_by,created_at,updated_at")
    .eq("game_id", gameId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    return { response: jsonDbError("Failed to load active join links", error) };
  }

  return { activeLinks: (data ?? []) as WoiGameJoinLinkRow[] };
}

async function revokeActiveJoinLinks(gameId: string, updatedAt: string) {
  const { data, error } = await supabaseAdmin
    .from("woi_game_join_links")
    .update({
      status: "revoked",
      updated_at: updatedAt,
    })
    .eq("game_id", gameId)
    .eq("status", "active")
    .select("id");

  if (error) {
    return { response: jsonDbError("Failed to revoke active join links", error) };
  }

  return {
    revokedIds: (data ?? []).map((row) => row.id as string),
  };
}

async function createJoinLink(input: {
  gameId: string;
  actorId: string;
  maxClaims: number | null;
  expiresAt: string | null;
}) {
  const rawToken = randomBytes(20).toString("hex");
  const tokenHash = hashJoinToken(rawToken);

  const { data, error } = await supabaseAdmin
    .from("woi_game_join_links")
    .insert({
      game_id: input.gameId,
      token_hash: tokenHash,
      status: "active",
      max_claims: input.maxClaims,
      expires_at: input.expiresAt,
      claims_count: 0,
      created_by: input.actorId,
      updated_at: nowIso(),
    })
    .select("id,game_id,token_hash,status,max_claims,claims_count,expires_at,created_by,created_at,updated_at")
    .single();

  if (error) {
    return { response: jsonDbError("Failed to create join link", error) };
  }

  return {
    joinLink: data as WoiGameJoinLinkRow,
    token: rawToken,
  };
}

async function updateGameJoinLinkEnabled(gameId: string, enabled: boolean, updatedAt: string) {
  const { error } = await supabaseAdmin
    .from("woi_games")
    .update({
      join_link_enabled: enabled,
      updated_at: updatedAt,
    })
    .eq("id", gameId);

  if (error) {
    return { response: jsonDbError("Failed to update game join-link availability", error) };
  }

  return { ok: true as const };
}

export async function GET(request: Request, context: RouteContext) {
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
    return jsonError("Only the game creator can view join links", {
      status: 403,
      code: "CREATOR_ONLY",
    });
  }

  const activeLinksResult = await loadActiveJoinLinks(gameResult.game.id);
  if ("response" in activeLinksResult) {
    return activeLinksResult.response;
  }

  const activeLink = activeLinksResult.activeLinks[0] ?? null;

  return jsonSuccess(
    {
      gameId: gameResult.game.id,
      joinLinkEnabled: gameResult.game.join_link_enabled,
      hasActiveLink: Boolean(activeLink),
      activeLink: activeLink
        ? {
            id: activeLink.id,
            status: activeLink.status,
            maxClaims: activeLink.max_claims,
            claimsCount: activeLink.claims_count,
            expiresAt: activeLink.expires_at,
            createdAt: activeLink.created_at,
            updatedAt: activeLink.updated_at,
          }
        : null,
    },
    { status: 200 },
  );
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON", {
      status: 400,
      code: "INVALID_JSON",
    });
  }

  const parsedBody = postBodySchema.safeParse(body);
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
    return jsonError("Only the game creator can manage join links", {
      status: 403,
      code: "CREATOR_ONLY",
    });
  }

  const activeLinksResult = await loadActiveJoinLinks(gameResult.game.id);
  if ("response" in activeLinksResult) {
    return activeLinksResult.response;
  }

  const activeLinks = activeLinksResult.activeLinks;
  const updateTimestamp = nowIso();
  const action = parsedBody.data.action;

  if (action === "revoke") {
    const revokeResult = await revokeActiveJoinLinks(gameResult.game.id, updateTimestamp);
    if ("response" in revokeResult) {
      return revokeResult.response;
    }

    const gamePatchResult = await updateGameJoinLinkEnabled(gameResult.game.id, false, updateTimestamp);
    if ("response" in gamePatchResult) {
      return gamePatchResult.response;
    }

    return jsonSuccess(
      {
        gameId: gameResult.game.id,
        action,
        revokedCount: revokeResult.revokedIds.length,
        joinLinkEnabled: false,
        activeLink: null,
      },
      { status: 200 },
    );
  }

  if (
    parsedBody.data.expiresAt
    && Date.parse(parsedBody.data.expiresAt) <= Date.now()
  ) {
    return jsonError("expiresAt must be in the future", {
      status: 400,
      code: "INVALID_EXPIRES_AT",
    });
  }

  if (action === "create" && activeLinks.length > 0) {
    return jsonError("An active join link already exists for this game", {
      status: 409,
      code: "JOIN_LINK_ALREADY_ACTIVE",
    });
  }

  if (action === "rotate") {
    const revokeResult = await revokeActiveJoinLinks(gameResult.game.id, updateTimestamp);
    if ("response" in revokeResult) {
      return revokeResult.response;
    }
  }

  const createResult = await createJoinLink({
    gameId: gameResult.game.id,
    actorId: actor.actorId,
    maxClaims: parsedBody.data.maxClaims ?? null,
    expiresAt: parsedBody.data.expiresAt ?? null,
  });
  if ("response" in createResult) {
    return createResult.response;
  }

  const gamePatchResult = await updateGameJoinLinkEnabled(gameResult.game.id, true, updateTimestamp);
  if ("response" in gamePatchResult) {
    return gamePatchResult.response;
  }

  return jsonSuccess(
    {
      gameId: gameResult.game.id,
      action,
      joinLinkEnabled: true,
      joinLink: {
        id: createResult.joinLink.id,
        status: createResult.joinLink.status,
        maxClaims: createResult.joinLink.max_claims,
        claimsCount: createResult.joinLink.claims_count,
        expiresAt: createResult.joinLink.expires_at,
        token: createResult.token,
        shareUrl: buildShareUrl(request, gameResult.game.id, createResult.token),
        createdAt: createResult.joinLink.created_at,
        updatedAt: createResult.joinLink.updated_at,
      },
    },
    { status: action === "create" ? 201 : 200 },
  );
}
