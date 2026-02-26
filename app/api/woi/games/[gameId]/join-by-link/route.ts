import "server-only";

import { z } from "zod";

import { getOptionalActorIdFromRequest } from "@/lib/auth/actor";
import { jsonError, jsonSuccess } from "@/lib/http";
import {
  claimOpenHumanSeat,
  findActiveJoinLink,
  joinViewerSession,
} from "@/lib/woi-lobby";
import { isViewerJoinAllowedForStatus } from "@/lib/woi-lobby-rules";
import {
  getGameById,
  getWoiAnonSessionIdFromRequest,
  jsonDbError,
  type WoiGameJoinLinkRow,
} from "@/lib/woi";
import { supabaseAdmin } from "@/lib/supabase/admin";

const paramsSchema = z.object({
  gameId: z.string().uuid(),
});

const bodySchema = z
  .object({
    token: z.string().trim().min(1).max(500),
    joinAs: z.enum(["player", "viewer"]),
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

async function incrementJoinLinkClaimUsage(
  joinLink: WoiGameJoinLinkRow,
): Promise<
  | { ok: true; claimsCount: number }
  | { ok: false; response: Response }
> {
  let candidate = joinLink;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (
      candidate.max_claims !== null
      && candidate.claims_count >= candidate.max_claims
    ) {
      return {
        ok: false,
        response: jsonError("Join link has reached its claim limit", {
          status: 409,
          code: "JOIN_LINK_CLAIMS_EXHAUSTED",
        }),
      };
    }

    const { data: updatedRows, error: updateError } = await supabaseAdmin
      .from("woi_game_join_links")
      .update({
        claims_count: candidate.claims_count + 1,
        updated_at: nowIso(),
      })
      .eq("id", candidate.id)
      .eq("status", "active")
      .eq("claims_count", candidate.claims_count)
      .select("id,game_id,token_hash,status,max_claims,claims_count,expires_at,created_by,created_at,updated_at")
      .limit(1);

    if (updateError) {
      return {
        ok: false,
        response: jsonDbError("Failed to update join link claim usage", updateError),
      };
    }

    const updated = updatedRows?.[0] as WoiGameJoinLinkRow | undefined;
    if (updated) {
      return {
        ok: true,
        claimsCount: updated.claims_count,
      };
    }

    const { data: latestRow, error: latestError } = await supabaseAdmin
      .from("woi_game_join_links")
      .select("id,game_id,token_hash,status,max_claims,claims_count,expires_at,created_by,created_at,updated_at")
      .eq("id", candidate.id)
      .maybeSingle();

    if (latestError) {
      return {
        ok: false,
        response: jsonDbError("Failed to refresh join link usage", latestError),
      };
    }

    if (!latestRow || latestRow.status !== "active") {
      return {
        ok: false,
        response: jsonError("Join link is invalid or unavailable", {
          status: 404,
          code: "JOIN_LINK_INVALID",
        }),
      };
    }

    candidate = latestRow as WoiGameJoinLinkRow;
  }

  return {
    ok: false,
    response: jsonError("Join link usage could not be updated due to concurrent claims", {
      status: 409,
      code: "JOIN_LINK_USAGE_CONFLICT",
    }),
  };
}

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
    return jsonError("Request body must be valid JSON", {
      status: 400,
      code: "INVALID_JSON",
    });
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

  if (!gameResult.game.join_link_enabled) {
    return jsonError("Join link is not enabled for this game", {
      status: 403,
      code: "JOIN_LINK_DISABLED",
    });
  }

  const joinLinkResult = await findActiveJoinLink({
    gameId: gameResult.game.id,
    token: parsedBody.data.token,
  });
  if (!joinLinkResult.ok) {
    return joinLinkResult.response;
  }

  if (parsedBody.data.joinAs === "player") {
    if (!actorId) {
      return jsonError("Authentication is required to claim a player seat", {
        status: 401,
        code: "AUTH_REQUIRED",
      });
    }

    if (
      joinLinkResult.joinLink.max_claims !== null
      && joinLinkResult.joinLink.claims_count >= joinLinkResult.joinLink.max_claims
    ) {
      return jsonError("Join link has reached its claim limit", {
        status: 409,
        code: "JOIN_LINK_CLAIMS_EXHAUSTED",
      });
    }

    const claimResult = await claimOpenHumanSeat(gameResult.game, actorId);
    if (!claimResult.ok) {
      return claimResult.response;
    }

    if (!claimResult.alreadyClaimed) {
      const claimUsage = await incrementJoinLinkClaimUsage(joinLinkResult.joinLink);
      if (!claimUsage.ok) {
        return claimUsage.response;
      }
    }

    return jsonSuccess(
      {
        gameId: gameResult.game.id,
        joinedAs: "player",
        slot: claimResult.slot,
        alreadyClaimed: claimResult.alreadyClaimed,
        remainingOpenHumanSeats: claimResult.remainingOpenHumanSeats,
      },
      { status: 200 },
    );
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

  const joinViewerResult = await joinViewerSession({
    gameId: gameResult.game.id,
    source: "join_link",
    actorId,
    anonSessionId: getWoiAnonSessionIdFromRequest(request),
  });
  if (!joinViewerResult.ok) {
    return joinViewerResult.response;
  }

  return jsonSuccess(
    {
      gameId: gameResult.game.id,
      joinedAs: "viewer",
      viewer: joinViewerResult.viewer,
      wasExistingSession: joinViewerResult.wasExistingSession,
      anonSessionId: joinViewerResult.anonSessionId,
    },
    { status: 200 },
  );
}
