import "server-only";

import crypto from "node:crypto";

import { env } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { areSeatClaimsAllowed, resolveViewerIdentity } from "@/lib/woi-lobby-rules";
import {
  jsonDbError,
  type WoiGameJoinLinkRow,
  type WoiGameRow,
  type WoiGameSlotRow,
  type WoiGameViewerRow,
  type WoiViewerSource,
} from "@/lib/woi";

const CLAIMABLE_HUMAN_SLOT_STATES = ["open", "released"] as const;
const ANON_SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{8,120}$/;
const ACTIVE_VIEWER_HEARTBEAT_WINDOW_MS = 5 * 60 * 1000;
const CLAIM_SEAT_RPC_ATTEMPTS = [
  {
    fn: "woi_claim_open_human_slot",
    args: (gameId: string, actorId: string) => ({ p_game_id: gameId, p_actor_id: actorId }),
  },
  {
    fn: "woi_claim_open_human_slot",
    args: (gameId: string, actorId: string) => ({ game_id: gameId, actor_id: actorId }),
  },
  {
    fn: "woi_claim_slot",
    args: (gameId: string, actorId: string) => ({ p_game_id: gameId, p_actor_id: actorId }),
  },
  {
    fn: "woi_claim_slot",
    args: (gameId: string, actorId: string) => ({ game_id: gameId, actor_id: actorId }),
  },
] as const;

export function hashJoinToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function nowIso() {
  return new Date().toISOString();
}

function activeViewerThresholdIso() {
  return new Date(Date.now() - ACTIVE_VIEWER_HEARTBEAT_WINDOW_MS).toISOString();
}

function isMissingRpcSignature(code: string | null | undefined) {
  return code === "PGRST202" || code === "PGRST204" || code === "42883";
}

async function loadExistingFilledHumanSeat(input: {
  gameId: string;
  actorId: string;
}): Promise<
  | { ok: true; seat: WoiGameSlotRow | null }
  | { ok: false; response: Response }
> {
  const { data, error } = await supabaseAdmin
    .from("woi_game_slots")
    .select("id,game_id,slot_index,seat_type,state,assigned_user_id,ai_profile,created_at,updated_at")
    .eq("game_id", input.gameId)
    .eq("seat_type", "human")
    .eq("assigned_user_id", input.actorId)
    .eq("state", "filled")
    .limit(1);

  if (error) {
    return {
      ok: false,
      response: jsonDbError("Failed to verify existing player seat claim", error),
    };
  }

  return {
    ok: true,
    seat: (data?.[0] as WoiGameSlotRow | undefined) ?? null,
  };
}

async function tryClaimOpenHumanSeatViaRpc(
  game: WoiGameRow,
  actorId: string,
): Promise<
  | {
      supported: false;
    }
  | {
      supported: true;
      ok: false;
      response: Response;
    }
  | {
      supported: true;
      ok: true;
      slot: WoiGameSlotRow;
      remainingOpenHumanSeats: number;
    }
> {
  let foundRpc = false;

  for (const attempt of CLAIM_SEAT_RPC_ATTEMPTS) {
    const { error } = await supabaseAdmin.rpc(
      attempt.fn,
      attempt.args(game.id, actorId),
    );

    if (error) {
      if (isMissingRpcSignature(error.code)) {
        continue;
      }

      return {
        supported: true,
        ok: false,
        response: jsonDbError("Failed to claim player seat", error),
      };
    }

    foundRpc = true;

    const existingSeatResult = await loadExistingFilledHumanSeat({
      gameId: game.id,
      actorId,
    });
    if (!existingSeatResult.ok) {
      return {
        supported: true,
        ok: false,
        response: existingSeatResult.response,
      };
    }

    if (!existingSeatResult.seat) {
      return {
        supported: true,
        ok: false,
        response: jsonError("No open player seats are available", {
          status: 409,
          code: "NO_OPEN_PLAYER_SEATS",
        }),
      };
    }

    const gamePatch = await patchGameAfterSeatClaim(game, actorId);
    if (gamePatch.error) {
      return {
        supported: true,
        ok: false,
        response: jsonDbError("Failed to update game after seat claim", gamePatch.error),
      };
    }

    const remainingCountResult = await countOpenHumanSeats(game.id);
    if (!remainingCountResult.ok) {
      return {
        supported: true,
        ok: false,
        response: remainingCountResult.response,
      };
    }

    return {
      supported: true,
      ok: true,
      slot: existingSeatResult.seat,
      remainingOpenHumanSeats: remainingCountResult.count,
    };
  }

  if (!foundRpc) {
    return {
      supported: false,
    };
  }

  return {
    supported: true,
    ok: false,
    response: jsonError("No open player seats are available", {
      status: 409,
      code: "NO_OPEN_PLAYER_SEATS",
    }),
  };
}

async function countOpenHumanSeats(gameId: string): Promise<
  | { ok: true; count: number }
  | { ok: false; response: Response }
> {
  const { count, error } = await supabaseAdmin
    .from("woi_game_slots")
    .select("id", { head: true, count: "exact" })
    .eq("game_id", gameId)
    .eq("seat_type", "human")
    .in("state", [...CLAIMABLE_HUMAN_SLOT_STATES]);

  if (error) {
    return {
      ok: false,
      response: jsonDbError("Failed to count open player seats", error),
    };
  }

  return {
    ok: true,
    count: count ?? 0,
  };
}

async function patchGameAfterSeatClaim(game: WoiGameRow, actorId: string) {
  const patch: {
    updated_at: string;
    current_player_id?: string;
  } = {
    updated_at: nowIso(),
  };

  if (!game.current_player_id) {
    patch.current_player_id = actorId;
  }

  const { error } = await supabaseAdmin
    .from("woi_games")
    .update(patch)
    .eq("id", game.id);

  return { error };
}

export async function claimOpenHumanSeat(
  game: WoiGameRow,
  actorId: string,
): Promise<
  | {
      ok: true;
      slot: WoiGameSlotRow;
      alreadyClaimed: boolean;
      remainingOpenHumanSeats: number;
    }
  | {
      ok: false;
      response: Response;
    }
> {
  if (!areSeatClaimsAllowed({
    status: game.status,
    seatClaimsLocked: game.seat_claims_locked,
  })) {
    return {
      ok: false,
      response: jsonError("Player claims are locked for this game", {
        status: 409,
        code: "PLAYER_CLAIMS_LOCKED",
      }),
    };
  }

  const existingSeatResult = await loadExistingFilledHumanSeat({
    gameId: game.id,
    actorId,
  });
  if (!existingSeatResult.ok) {
    return {
      ok: false,
      response: existingSeatResult.response,
    };
  }

  if (existingSeatResult.seat) {
    const remainingCountResult = await countOpenHumanSeats(game.id);
    if (!remainingCountResult.ok) {
      return remainingCountResult;
    }

    return {
      ok: true,
      slot: existingSeatResult.seat,
      alreadyClaimed: true,
      remainingOpenHumanSeats: remainingCountResult.count,
    };
  }

  const atomicRpcResult = await tryClaimOpenHumanSeatViaRpc(game, actorId);
  if (atomicRpcResult.supported) {
    if (!atomicRpcResult.ok) {
      return {
        ok: false,
        response: atomicRpcResult.response,
      };
    }

    return {
      ok: true,
      slot: atomicRpcResult.slot,
      alreadyClaimed: false,
      remainingOpenHumanSeats: atomicRpcResult.remainingOpenHumanSeats,
    };
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data: candidateRows, error: candidateError } = await supabaseAdmin
      .from("woi_game_slots")
      .select("id,slot_index")
      .eq("game_id", game.id)
      .eq("seat_type", "human")
      .in("state", [...CLAIMABLE_HUMAN_SLOT_STATES])
      .order("slot_index", { ascending: true })
      .limit(1);

    if (candidateError) {
      return {
        ok: false,
        response: jsonDbError("Failed to load open player seats", candidateError),
      };
    }

    const candidate = candidateRows?.[0];
    if (!candidate) {
      return {
        ok: false,
        response: jsonError("No open player seats are available", {
          status: 409,
          code: "NO_OPEN_PLAYER_SEATS",
        }),
      };
    }

    const { data: claimedRows, error: claimError } = await supabaseAdmin
      .from("woi_game_slots")
      .update({
        state: "filled",
        assigned_user_id: actorId,
        updated_at: nowIso(),
      })
      .eq("id", candidate.id)
      .eq("seat_type", "human")
      .is("assigned_user_id", null)
      .in("state", [...CLAIMABLE_HUMAN_SLOT_STATES])
      .select("id,game_id,slot_index,seat_type,state,assigned_user_id,ai_profile,created_at,updated_at");

    if (claimError) {
      return {
        ok: false,
        response: jsonDbError("Failed to claim player seat", claimError),
      };
    }

    const claimed = claimedRows?.[0] as WoiGameSlotRow | undefined;
    if (!claimed) {
      // Another actor claimed this seat first; retry.
      continue;
    }

    const gamePatch = await patchGameAfterSeatClaim(game, actorId);
    if (gamePatch.error) {
      return {
        ok: false,
        response: jsonDbError("Failed to update game after seat claim", gamePatch.error),
      };
    }

    const remainingCountResult = await countOpenHumanSeats(game.id);
    if (!remainingCountResult.ok) {
      return remainingCountResult;
    }

    return {
      ok: true,
      slot: claimed,
      alreadyClaimed: false,
      remainingOpenHumanSeats: remainingCountResult.count,
    };
  }

  return {
    ok: false,
    response: jsonError("No open player seats are available", {
      status: 409,
      code: "NO_OPEN_PLAYER_SEATS",
    }),
  };
}

function normalizeAnonSessionId(candidate: string | null | undefined): string | null {
  const value = candidate?.trim() ?? "";
  if (!value || !ANON_SESSION_ID_PATTERN.test(value)) {
    return null;
  }

  return value;
}

export async function joinViewerSession(input: {
  gameId: string;
  source: WoiViewerSource;
  actorId: string | null;
  anonSessionId?: string | null;
}): Promise<
  | {
      ok: true;
      viewer: WoiGameViewerRow;
      wasExistingSession: boolean;
      anonSessionId: string | null;
    }
  | {
      ok: false;
      response: Response;
    }
> {
  const normalizedAnonSessionId = normalizeAnonSessionId(input.anonSessionId);
  const viewerIdentity = resolveViewerIdentity({
    actorId: input.actorId,
    anonSessionId: normalizedAnonSessionId,
    fallbackAnonSessionId: crypto.randomUUID(),
  });
  const anonSessionId = viewerIdentity.anonSessionId;

  const viewerLookup = viewerIdentity.actorId
    ? supabaseAdmin
        .from("woi_game_viewers")
        .select("id,game_id,user_id,anon_session_id,source,joined_at,last_seen_at,left_at")
        .eq("game_id", input.gameId)
        .eq("user_id", viewerIdentity.actorId)
        .is("left_at", null)
        .limit(1)
    : supabaseAdmin
        .from("woi_game_viewers")
        .select("id,game_id,user_id,anon_session_id,source,joined_at,last_seen_at,left_at")
        .eq("game_id", input.gameId)
        .eq("anon_session_id", anonSessionId ?? "")
        .is("left_at", null)
        .limit(1);

  const { data: existingRows, error: existingError } = await viewerLookup;
  if (existingError) {
    return {
      ok: false,
      response: jsonDbError("Failed to verify viewer session", existingError),
    };
  }

  const existing = existingRows?.[0] as WoiGameViewerRow | undefined;
  if (existing) {
    const { data: refreshedRows, error: refreshError } = await supabaseAdmin
      .from("woi_game_viewers")
      .update({
        source: input.source,
        last_seen_at: nowIso(),
      })
      .eq("id", existing.id)
      .select("id,game_id,user_id,anon_session_id,source,joined_at,last_seen_at,left_at")
      .limit(1);

    if (refreshError) {
      return {
        ok: false,
        response: jsonDbError("Failed to refresh viewer session", refreshError),
      };
    }

    const refreshed = (refreshedRows?.[0] ?? existing) as WoiGameViewerRow;

    return {
      ok: true,
      viewer: refreshed,
      wasExistingSession: true,
      anonSessionId: refreshed.anon_session_id ?? anonSessionId,
    };
  }

  const { count: activeViewerCount, error: activeViewerError } = await supabaseAdmin
    .from("woi_game_viewers")
    .select("id", { head: true, count: "exact" })
    .eq("game_id", input.gameId)
    .is("left_at", null)
    .gte("last_seen_at", activeViewerThresholdIso());

  if (activeViewerError) {
    return {
      ok: false,
      response: jsonDbError("Failed to verify viewer capacity", activeViewerError),
    };
  }

  if ((activeViewerCount ?? 0) >= env.WOI_VIEWER_CAP_PER_GAME) {
    return {
      ok: false,
      response: jsonError("room is full", {
        status: 409,
        code: "ROOM_FULL",
      }),
    };
  }

  const { data: insertedRows, error: insertError } = await supabaseAdmin
    .from("woi_game_viewers")
    .insert({
      game_id: input.gameId,
      user_id: viewerIdentity.actorId,
      anon_session_id: anonSessionId,
      source: input.source,
      joined_at: nowIso(),
      last_seen_at: nowIso(),
    })
    .select("id,game_id,user_id,anon_session_id,source,joined_at,last_seen_at,left_at")
    .limit(1);

  if (insertError) {
    if (insertError.code === "23505") {
      return joinViewerSession(input);
    }

    return {
      ok: false,
      response: jsonDbError("Failed to join as viewer", insertError),
    };
  }

  const viewer = insertedRows?.[0] as WoiGameViewerRow | undefined;
  if (!viewer) {
    return {
      ok: false,
      response: jsonError("Failed to join as viewer", {
        status: 500,
        code: "VIEWER_JOIN_FAILED",
      }),
    };
  }

  return {
    ok: true,
    viewer,
    wasExistingSession: false,
    anonSessionId: viewer.anon_session_id ?? anonSessionId,
  };
}

export async function findActiveJoinLink(input: {
  gameId: string;
  token: string;
}): Promise<
  | { ok: true; joinLink: WoiGameJoinLinkRow }
  | { ok: false; response: Response }
> {
  const token = input.token.trim();
  if (!token) {
    return {
      ok: false,
      response: jsonError("Join token is required", {
        status: 400,
        code: "JOIN_TOKEN_REQUIRED",
      }),
    };
  }

  const tokenHash = hashJoinToken(token);

  let joinLinkQuery = await supabaseAdmin
    .from("woi_game_join_links")
    .select("id,game_id,token_hash,status,max_claims,claims_count,expires_at,created_by,created_at,updated_at")
    .eq("game_id", input.gameId)
    .eq("status", "active")
    .eq("token_hash", tokenHash)
    .limit(1);

  if (joinLinkQuery.error) {
    return {
      ok: false,
      response: jsonDbError("Failed to verify join link", joinLinkQuery.error),
    };
  }

  let link = joinLinkQuery.data?.[0] as WoiGameJoinLinkRow | undefined;
  if (!link && tokenHash !== token) {
    joinLinkQuery = await supabaseAdmin
      .from("woi_game_join_links")
      .select("id,game_id,token_hash,status,max_claims,claims_count,expires_at,created_by,created_at,updated_at")
      .eq("game_id", input.gameId)
      .eq("status", "active")
      .eq("token_hash", token)
      .limit(1);

    if (joinLinkQuery.error) {
      return {
        ok: false,
        response: jsonDbError("Failed to verify join link", joinLinkQuery.error),
      };
    }

    link = joinLinkQuery.data?.[0] as WoiGameJoinLinkRow | undefined;
  }

  if (!link) {
    return {
      ok: false,
      response: jsonError("Join link is invalid or unavailable", {
        status: 404,
        code: "JOIN_LINK_INVALID",
      }),
    };
  }

  if (link.expires_at && Date.parse(link.expires_at) <= Date.now()) {
    return {
      ok: false,
      response: jsonError("Join link has expired", {
        status: 410,
        code: "JOIN_LINK_EXPIRED",
      }),
    };
  }

  return {
    ok: true,
    joinLink: link,
  };
}
