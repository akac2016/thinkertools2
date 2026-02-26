import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

import {
  getOptionalActorIdFromRequest,
  requireActorIdFromRequest,
} from "@/lib/auth/actor";
import { jsonError } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";

type ActorSuccess = { actorId: string };
type ActorFailure = { response: Response };

type JsonRecord = Record<string, unknown>;

export type WoiGameStatus = "lobby" | "in_play" | "reflect" | "finished";
export type WoiLobbyVisibility = "hidden" | "listed";
export type WoiCreatorRole = "player" | "viewer";
export type WoiGameSeatType = "human" | "ai";
export type WoiGameSlotState = "open" | "invited" | "filled" | "released" | "locked";
export type WoiInviteChannel = "platform_search" | "email" | "join_link";
export type WoiInviteStatus =
  | "pending"
  | "sent"
  | "accepted"
  | "declined"
  | "expired"
  | "revoked"
  | "failed";
export type WoiViewerSource = "lobby" | "join_link" | "public_url" | "manual";
export type WoiJoinLinkStatus = "active" | "revoked" | "expired";
export const WOI_ANON_SESSION_ID_HEADER = "x-woi-anon-session-id";
const WOI_ANON_SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{8,120}$/;

export const WOI_GAME_SELECT_COLUMNS =
  "id,template_id,team_id,creator_id,question,description,is_public,status,current_player_id,total_player_slots,ai_player_slots,lobby_visibility,join_link_enabled,creator_role,seat_claims_locked,created_at,updated_at";

export type WoiGameRow = {
  id: string;
  template_id: string;
  team_id: string;
  creator_id: string;
  question: string;
  description: string;
  is_public: boolean;
  status: WoiGameStatus;
  current_player_id: string | null;
  total_player_slots: number;
  ai_player_slots: number;
  lobby_visibility: WoiLobbyVisibility;
  join_link_enabled: boolean;
  creator_role: WoiCreatorRole;
  seat_claims_locked: boolean;
  created_at: string;
  updated_at: string;
};

export type WoiGameSlotRow = {
  id: string;
  game_id: string;
  slot_index: number;
  seat_type: WoiGameSeatType;
  state: WoiGameSlotState;
  assigned_user_id: string | null;
  ai_profile: JsonRecord | null;
  created_at: string;
  updated_at: string;
};

export type WoiGameInviteRow = {
  id: string;
  game_id: string;
  slot_id: string;
  channel: WoiInviteChannel;
  invited_user_id: string | null;
  invited_email: string | null;
  token_hash: string | null;
  status: WoiInviteStatus;
  expires_at: string | null;
  accepted_by_user_id: string | null;
  accepted_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type WoiGameViewerRow = {
  id: string;
  game_id: string;
  user_id: string | null;
  anon_session_id: string | null;
  source: WoiViewerSource;
  joined_at: string;
  last_seen_at: string;
  left_at: string | null;
};

export type WoiGameJoinLinkRow = {
  id: string;
  game_id: string;
  token_hash: string;
  status: WoiJoinLinkStatus;
  max_claims: number | null;
  claims_count: number;
  expires_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type WoiRosterPresetRow = {
  id: string;
  owner_user_id: string;
  team_id: string | null;
  name: string;
  source_game_id: string | null;
  slots: unknown[];
  created_at: string;
  updated_at: string;
};

export type TeamMemberRow = {
  id: string;
  team_id: string;
  user_id: string;
  role: "member" | "manager";
  created_at: string;
};

export type UserRow = {
  id: string;
  name: string;
  username: string;
  email: string | null;
  color: string;
};

export type WoiGameAccessContext = {
  actorId: string | null;
  anonSessionId: string | null;
};

export async function requireActorId(request: Request): Promise<ActorSuccess | ActorFailure> {
  const actor = await requireActorIdFromRequest(request);
  if (!actor.ok) {
    return { response: actor.response };
  }

  return { actorId: actor.actorId };
}

export function getWoiAnonSessionIdFromRequest(request: Request): string | null {
  const raw = request.headers.get(WOI_ANON_SESSION_ID_HEADER)?.trim();
  if (!raw || !WOI_ANON_SESSION_ID_PATTERN.test(raw)) {
    return null;
  }

  return raw;
}

export async function resolveWoiGameAccessContext(
  request: Request,
): Promise<WoiGameAccessContext> {
  const [actorId, anonSessionId] = await Promise.all([
    getOptionalActorIdFromRequest(request),
    Promise.resolve(getWoiAnonSessionIdFromRequest(request)),
  ]);

  return {
    actorId,
    anonSessionId,
  };
}

export function jsonDbError(
  message: string,
  error: PostgrestError,
  status = 500,
): Response {
  return jsonError(message, {
    status,
    code: "DB_ERROR",
    details: {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    },
  });
}

export function uniqueIds(ids: Array<string | null | undefined>): string[] {
  return Array.from(new Set(ids.filter((value): value is string => Boolean(value))));
}

export async function isTeamMember(teamId: string, userId: string) {
  const { count, error } = await supabaseAdmin
    .from("team_members")
    .select("id", { head: true, count: "exact" })
    .eq("team_id", teamId)
    .eq("user_id", userId);

  if (error) {
    return { response: jsonDbError("Failed to verify team membership", error) };
  }

  return { isMember: (count ?? 0) > 0 };
}

export async function getTeamMembersOrdered(teamId: string) {
  const { data, error } = await supabaseAdmin
    .from("team_members")
    .select("id,team_id,user_id,role,created_at")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    return { response: jsonDbError("Failed to load team members", error) };
  }

  return { members: (data ?? []) as TeamMemberRow[] };
}

export async function getGameById(gameId: string) {
  const { data, error } = await supabaseAdmin
    .from("woi_games")
    .select(WOI_GAME_SELECT_COLUMNS)
    .eq("id", gameId)
    .maybeSingle();

  if (error) {
    return { response: jsonDbError("Failed to load game", error) };
  }

  return { game: (data as WoiGameRow | null) ?? null };
}

export async function canActorReadGame(game: WoiGameRow, actorId: string) {
  return canAccessGame(game, {
    actorId,
    anonSessionId: null,
  });
}

export async function canAccessGame(
  game: WoiGameRow,
  access: WoiGameAccessContext,
) {
  if (
    game.is_public
    || (game.status === "lobby" && game.lobby_visibility === "listed")
  ) {
    return { canRead: true as const };
  }

  if (access.actorId) {
    const [membership, seatAssignmentResult, viewerResult] = await Promise.all([
      isTeamMember(game.team_id, access.actorId),
      supabaseAdmin
        .from("woi_game_slots")
        .select("id", { head: true, count: "exact" })
        .eq("game_id", game.id)
        .eq("seat_type", "human")
        .eq("assigned_user_id", access.actorId),
      supabaseAdmin
        .from("woi_game_viewers")
        .select("id", { head: true, count: "exact" })
        .eq("game_id", game.id)
        .eq("user_id", access.actorId)
        .is("left_at", null),
    ]);

    if ("response" in membership) {
      return { response: membership.response };
    }
    if (seatAssignmentResult.error && seatAssignmentResult.error.code !== "42P01") {
      return {
        response: jsonDbError(
          "Failed to verify assigned player seat access",
          seatAssignmentResult.error,
        ),
      };
    }
    if (viewerResult.error && viewerResult.error.code !== "42P01") {
      return {
        response: jsonDbError("Failed to verify viewer access", viewerResult.error),
      };
    }

    const hasAssignedSeat = (seatAssignmentResult.count ?? 0) > 0;
    const hasActiveViewerSession = (viewerResult.count ?? 0) > 0;

    if (membership.isMember || hasAssignedSeat || hasActiveViewerSession) {
      return { canRead: true as const };
    }
  }

  if (access.anonSessionId) {
    const { count, error } = await supabaseAdmin
      .from("woi_game_viewers")
      .select("id", { head: true, count: "exact" })
      .eq("game_id", game.id)
      .eq("anon_session_id", access.anonSessionId)
      .is("left_at", null);

    if (error && error.code !== "42P01") {
      return {
        response: jsonDbError("Failed to verify anonymous viewer access", error),
      };
    }

    if ((count ?? 0) > 0) {
      return { canRead: true as const };
    }
  }

  return { canRead: false as const };
}

export async function getUsersByIds(ids: string[]) {
  const unique = uniqueIds(ids);
  if (unique.length === 0) {
    return { users: [] as UserRow[] };
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id,name,username,email,color")
    .in("id", unique);

  if (error) {
    return { response: jsonDbError("Failed to load users", error) };
  }

  return { users: (data ?? []) as UserRow[] };
}
