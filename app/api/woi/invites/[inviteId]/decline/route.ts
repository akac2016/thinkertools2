import "server-only";

import { z } from "zod";

import { jsonError, jsonSuccess } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActorEmail, loadWoiInviteContext } from "@/lib/woi-invites";
import { jsonDbError, requireActorId, type WoiGameInviteRow } from "@/lib/woi";

const paramsSchema = z.object({
  inviteId: z.string().uuid(),
});

type RouteContext = {
  params: Promise<{
    inviteId: string;
  }>;
};

const DECLINABLE_INVITE_STATUSES = ["pending", "sent"] as const;

function nowIso() {
  return new Date().toISOString();
}

function canActorDeclineInvite(input: {
  actorId: string;
  actorEmail: string | null;
  invite: WoiGameInviteRow;
}) {
  if (input.invite.invited_user_id) {
    return input.invite.invited_user_id === input.actorId;
  }

  const invitedEmail = input.invite.invited_email?.trim().toLowerCase() ?? "";
  const actorEmail = input.actorEmail?.trim().toLowerCase() ?? "";
  if (invitedEmail && actorEmail) {
    return invitedEmail === actorEmail;
  }

  return false;
}

export async function POST(request: Request, context: RouteContext) {
  const actor = await requireActorId(request);
  if ("response" in actor) {
    return actor.response;
  }

  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) {
    return jsonError("Invalid invite id", {
      status: 400,
      code: "INVALID_INVITE_ID",
      details: params.error.flatten(),
    });
  }

  const [inviteContextResult, actorEmailResult] = await Promise.all([
    loadWoiInviteContext(params.data.inviteId),
    getActorEmail(actor.actorId),
  ]);

  if (!inviteContextResult.ok) {
    return inviteContextResult.response;
  }
  if (!actorEmailResult.ok) {
    return actorEmailResult.response;
  }

  const { invite, game, slot } = inviteContextResult.context;
  if (!canActorDeclineInvite({
    actorId: actor.actorId,
    actorEmail: actorEmailResult.email,
    invite,
  })) {
    return jsonError("This invite is not assigned to the authenticated actor", {
      status: 403,
      code: "INVITE_FORBIDDEN",
    });
  }

  if (invite.status === "declined") {
    return jsonSuccess(
      {
        inviteId: invite.id,
        gameId: invite.game_id,
        slotId: invite.slot_id,
        alreadyDeclined: true,
      },
      { status: 200 },
    );
  }

  if (!DECLINABLE_INVITE_STATUSES.includes(invite.status as (typeof DECLINABLE_INVITE_STATUSES)[number])) {
    return jsonError("Invite can no longer be declined", {
      status: 409,
      code: "INVITE_NOT_DECLINABLE",
      details: {
        status: invite.status,
      },
    });
  }

  const updateTimestamp = nowIso();
  const { data: declinedRows, error: declineError } = await supabaseAdmin
    .from("woi_game_invites")
    .update({
      status: "declined",
      accepted_by_user_id: null,
      accepted_at: null,
      updated_at: updateTimestamp,
    })
    .eq("id", invite.id)
    .in("status", [...DECLINABLE_INVITE_STATUSES, "declined"])
    .select(
      "id,game_id,slot_id,channel,invited_user_id,invited_email,token_hash,status,expires_at,accepted_by_user_id,accepted_at,created_by,created_at,updated_at",
    );

  if (declineError) {
    return jsonDbError("Failed to decline invite", declineError);
  }

  const declinedInvite = declinedRows?.[0] as WoiGameInviteRow | undefined;
  if (!declinedInvite) {
    return jsonError("Invite decline could not be confirmed", {
      status: 500,
      code: "INVITE_DECLINE_CONFIRMATION_FAILED",
    });
  }

  let reopenedSlot = false;
  if (
    slot.seat_type === "human"
    && slot.state === "invited"
    && !slot.assigned_user_id
    && game.status === "lobby"
    && !game.seat_claims_locked
  ) {
    const { error: reopenSlotError } = await supabaseAdmin
      .from("woi_game_slots")
      .update({
        state: "open",
        updated_at: updateTimestamp,
      })
      .eq("id", slot.id)
      .eq("seat_type", "human")
      .eq("state", "invited")
      .is("assigned_user_id", null);

    if (reopenSlotError) {
      return jsonDbError("Invite declined, but failed to reopen seat", reopenSlotError);
    }

    reopenedSlot = true;
  }

  const { error: gamePatchError } = await supabaseAdmin
    .from("woi_games")
    .update({
      updated_at: updateTimestamp,
    })
    .eq("id", game.id);

  if (gamePatchError) {
    return jsonDbError("Invite declined, but game metadata update failed", gamePatchError);
  }

  return jsonSuccess(
    {
      invite: declinedInvite,
      gameId: game.id,
      reopenedSlot,
      alreadyDeclined: false,
    },
    { status: 200 },
  );
}
