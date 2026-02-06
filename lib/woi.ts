import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";

import { getDemoActorFromRequest } from "@/lib/demo-auth";
import { jsonError } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";

type ActorSuccess = { actorId: string };
type ActorFailure = { response: Response };
const actorIdSchema = z.string().uuid();

export type WoiGameRow = {
  id: string;
  template_id: string;
  team_id: string;
  creator_id: string;
  question: string;
  description: string;
  is_public: boolean;
  status: "in_play" | "reflect" | "finished";
  current_player_id: string | null;
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
  email: string | null;
  color: string;
};

export function requireActorId(request: Request): ActorSuccess | ActorFailure {
  const actor = getDemoActorFromRequest(request);
  if (!actor.userId) {
    return {
      response: jsonError("Missing demo actor. Provide x-demo-user-id header.", {
        status: 401,
        code: "UNAUTHENTICATED",
      }),
    };
  }

  const parsedActorId = actorIdSchema.safeParse(actor.userId);
  if (!parsedActorId.success) {
    return {
      response: jsonError("Invalid demo actor id. Provide a UUID in x-demo-user-id header.", {
        status: 400,
        code: "INVALID_ACTOR_ID",
        details: parsedActorId.error.flatten(),
      }),
    };
  }

  return { actorId: parsedActorId.data };
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
    .select(
      "id,template_id,team_id,creator_id,question,description,is_public,status,current_player_id,created_at,updated_at",
    )
    .eq("id", gameId)
    .maybeSingle();

  if (error) {
    return { response: jsonDbError("Failed to load game", error) };
  }

  return { game: (data as WoiGameRow | null) ?? null };
}

export async function canActorReadGame(game: WoiGameRow, actorId: string) {
  if (game.is_public || game.creator_id === actorId) {
    return { canRead: true as const };
  }

  const membership = await isTeamMember(game.team_id, actorId);
  if ("response" in membership) {
    return { response: membership.response };
  }

  return { canRead: membership.isMember };
}

export async function getUsersByIds(ids: string[]) {
  const unique = uniqueIds(ids);
  if (unique.length === 0) {
    return { users: [] as UserRow[] };
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id,name,email,color")
    .in("id", unique);

  if (error) {
    return { response: jsonDbError("Failed to load users", error) };
  }

  return { users: (data ?? []) as UserRow[] };
}
