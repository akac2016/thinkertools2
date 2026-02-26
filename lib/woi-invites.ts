import "server-only";

import { jsonError } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getGameById,
  jsonDbError,
  type WoiGameInviteRow,
  type WoiGameRow,
  type WoiGameSlotRow,
} from "@/lib/woi";

export type WoiInviteContext = {
  invite: WoiGameInviteRow;
  slot: WoiGameSlotRow;
  game: WoiGameRow;
};

export async function loadWoiInviteContext(inviteId: string): Promise<
  | { ok: true; context: WoiInviteContext }
  | { ok: false; response: Response }
> {
  const { data: inviteData, error: inviteError } = await supabaseAdmin
    .from("woi_game_invites")
    .select(
      "id,game_id,slot_id,channel,invited_user_id,invited_email,token_hash,status,expires_at,accepted_by_user_id,accepted_at,created_by,created_at,updated_at",
    )
    .eq("id", inviteId)
    .maybeSingle();

  if (inviteError) {
    return {
      ok: false,
      response: jsonDbError("Failed to load invite", inviteError),
    };
  }
  if (!inviteData) {
    return {
      ok: false,
      response: jsonError("Invite not found", {
        status: 404,
        code: "INVITE_NOT_FOUND",
      }),
    };
  }

  const invite = inviteData as WoiGameInviteRow;

  const { data: slotData, error: slotError } = await supabaseAdmin
    .from("woi_game_slots")
    .select("id,game_id,slot_index,seat_type,state,assigned_user_id,ai_profile,created_at,updated_at")
    .eq("id", invite.slot_id)
    .maybeSingle();

  if (slotError) {
    return {
      ok: false,
      response: jsonDbError("Failed to load invite slot", slotError),
    };
  }
  if (!slotData) {
    return {
      ok: false,
      response: jsonError("Invite slot not found", {
        status: 404,
        code: "INVITE_SLOT_NOT_FOUND",
      }),
    };
  }

  const slot = slotData as WoiGameSlotRow;
  if (slot.game_id !== invite.game_id) {
    return {
      ok: false,
      response: jsonError("Invite slot does not belong to invite game", {
        status: 409,
        code: "INVITE_SLOT_MISMATCH",
      }),
    };
  }

  const gameResult = await getGameById(invite.game_id);
  if ("response" in gameResult) {
    if (!gameResult.response) {
      return {
        ok: false,
        response: jsonError("Failed to load invite game", {
          status: 500,
          code: "INVITE_GAME_LOAD_FAILED",
        }),
      };
    }

    return {
      ok: false,
      response: gameResult.response,
    };
  }
  if (!gameResult.game) {
    return {
      ok: false,
      response: jsonError("Invite game not found", {
        status: 404,
        code: "INVITE_GAME_NOT_FOUND",
      }),
    };
  }

  return {
    ok: true,
    context: {
      invite,
      slot,
      game: gameResult.game,
    },
  };
}

export async function getActorEmail(actorId: string): Promise<
  | { ok: true; email: string | null }
  | { ok: false; response: Response }
> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("email")
    .eq("id", actorId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      response: jsonDbError("Failed to resolve actor profile", error),
    };
  }

  return {
    ok: true,
    email: (data?.email as string | null | undefined) ?? null,
  };
}
