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

const ACCEPTABLE_INVITE_STATUSES = ["pending", "sent"] as const;

function nowIso() {
  return new Date().toISOString();
}

function canActorAcceptInvite(input: {
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
  if (!canActorAcceptInvite({
    actorId: actor.actorId,
    actorEmail: actorEmailResult.email,
    invite,
  })) {
    return jsonError("This invite is not assigned to the authenticated actor", {
      status: 403,
      code: "INVITE_FORBIDDEN",
    });
  }

  if (
    invite.status === "accepted"
    && invite.accepted_by_user_id === actor.actorId
  ) {
    return jsonSuccess(
      {
        inviteId: invite.id,
        gameId: invite.game_id,
        slotId: invite.slot_id,
        alreadyAccepted: true,
      },
      { status: 200 },
    );
  }

  if (!ACCEPTABLE_INVITE_STATUSES.includes(invite.status as (typeof ACCEPTABLE_INVITE_STATUSES)[number])) {
    return jsonError("Invite can no longer be accepted", {
      status: 409,
      code: "INVITE_NOT_ACCEPTABLE",
      details: {
        status: invite.status,
      },
    });
  }

  if (game.status !== "lobby" || game.seat_claims_locked) {
    return jsonError("Player claims are locked for this game", {
      status: 409,
      code: "PLAYER_CLAIMS_LOCKED",
    });
  }

  if (slot.seat_type !== "human") {
    return jsonError("Invite slot is not a human player seat", {
      status: 409,
      code: "INVITE_SLOT_INVALID",
    });
  }

  const updateTimestamp = nowIso();
  const { data: claimedRows, error: claimError } = await supabaseAdmin
    .from("woi_game_slots")
    .update({
      state: "filled",
      assigned_user_id: actor.actorId,
      updated_at: updateTimestamp,
    })
    .eq("id", slot.id)
    .eq("seat_type", "human")
    .is("assigned_user_id", null)
    .eq("game_id", game.id)
    .in("state", ["invited", "open", "released"])
    .select("id,game_id,slot_index,seat_type,state,assigned_user_id,ai_profile,created_at,updated_at");

  if (claimError) {
    return jsonDbError("Failed to claim invite slot", claimError);
  }

  const claimedSlot = claimedRows?.[0];
  if (!claimedSlot) {
    return jsonError("Invite slot is no longer claimable", {
      status: 409,
      code: "INVITE_SLOT_UNAVAILABLE",
    });
  }

  const { data: inviteRows, error: acceptInviteError } = await supabaseAdmin
    .from("woi_game_invites")
    .update({
      status: "accepted",
      accepted_by_user_id: actor.actorId,
      accepted_at: updateTimestamp,
      updated_at: updateTimestamp,
    })
    .eq("id", invite.id)
    .in("status", [...ACCEPTABLE_INVITE_STATUSES])
    .select(
      "id,game_id,slot_id,channel,invited_user_id,invited_email,token_hash,status,expires_at,accepted_by_user_id,accepted_at,created_by,created_at,updated_at",
    );

  if (acceptInviteError) {
    return jsonDbError("Invite was claimed but could not be marked accepted", acceptInviteError);
  }

  const acceptedInvite = inviteRows?.[0] as WoiGameInviteRow | undefined;
  if (!acceptedInvite) {
    return jsonError("Invite can no longer be accepted", {
      status: 409,
      code: "INVITE_NOT_ACCEPTABLE",
    });
  }

  const { error: revokeSiblingInvitesError } = await supabaseAdmin
    .from("woi_game_invites")
    .update({
      status: "revoked",
      updated_at: updateTimestamp,
    })
    .eq("slot_id", slot.id)
    .neq("id", invite.id)
    .in("status", [...ACCEPTABLE_INVITE_STATUSES]);

  if (revokeSiblingInvitesError) {
    return jsonDbError("Invite accepted, but failed to revoke sibling invites", revokeSiblingInvitesError);
  }

  const gamePatch: { updated_at: string; current_player_id?: string } = {
    updated_at: updateTimestamp,
  };
  if (!game.current_player_id) {
    gamePatch.current_player_id = actor.actorId;
  }

  const { error: gamePatchError } = await supabaseAdmin
    .from("woi_games")
    .update(gamePatch)
    .eq("id", game.id);

  if (gamePatchError) {
    return jsonDbError("Invite accepted, but game metadata update failed", gamePatchError);
  }

  return jsonSuccess(
    {
      invite: acceptedInvite,
      slot: claimedSlot,
      gameId: game.id,
      alreadyAccepted: false,
    },
    { status: 200 },
  );
}
