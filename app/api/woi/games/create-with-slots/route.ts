import "server-only";

import { createHash, randomBytes } from "crypto";

import { z } from "zod";

import { jsonError, jsonSuccess } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolveCreateWithSlotsLifecycle } from "@/lib/woi-lobby-rules";
import {
  WOI_GAME_SELECT_COLUMNS,
  isTeamMember,
  jsonDbError,
  requireActorId,
  type WoiGameInviteRow,
  type WoiGameRow,
  type WoiGameSlotRow,
} from "@/lib/woi";

const platformSeatInstructionSchema = z.object({
  mode: z.literal("platform_user"),
  userId: z.string().uuid(),
}).strict();

const emailSeatInstructionSchema = z.object({
  mode: z.literal("email"),
  email: z.string().trim().email().max(320),
}).strict();

const openSeatInstructionSchema = z.object({
  mode: z.literal("open"),
}).strict();

const humanSeatInstructionSchema = z.discriminatedUnion("mode", [
  platformSeatInstructionSchema,
  emailSeatInstructionSchema,
  openSeatInstructionSchema,
]);

const opponentSchema = z.object({
  codename: z.string().trim().min(1).max(80),
  narrative: z.string().trim().min(1).max(400),
  intelligence: z.enum(["novice", "analytical", "strategic", "expert"]),
  difficulty: z.enum(["easy", "medium", "hard", "adaptive"]),
  imageUrl: z.string().trim().url().or(z.string().startsWith("data:image/")),
}).strict();

const createWithSlotsSchema = z.object({
  templateId: z.string().uuid(),
  teamId: z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return undefined;
      }
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    },
    z.string().uuid().optional(),
  ),
  question: z.string().trim().min(1).max(2000),
  description: z.string().trim().min(1).max(8000),
  isPublic: z.boolean().optional().default(false),
  totalPlayerSlots: z.number().int().min(1).max(20),
  aiPlayerSlots: z.number().int().min(0).max(4),
  creatorRole: z.enum(["player", "viewer"]),
  humanSeats: z.array(humanSeatInstructionSchema).max(20).default([]),
  opponents: z.array(opponentSchema).max(4).default([]),
  presetId: z.string().uuid().optional(),
  lobbyVisibility: z.enum(["hidden", "listed"]).optional().default("hidden"),
  joinLinkEnabled: z.boolean().optional().default(false),
}).superRefine((value, context) => {
  if (value.aiPlayerSlots > value.totalPlayerSlots) {
    context.addIssue({
      code: "custom",
      path: ["aiPlayerSlots"],
      message: "AI player slots cannot exceed total player slots",
    });
  }

  const humanPlayerSlots = value.totalPlayerSlots - value.aiPlayerSlots;
  if (value.creatorRole === "player" && humanPlayerSlots < 1) {
    context.addIssue({
      code: "custom",
      path: ["creatorRole"],
      message: "Creator cannot be a player when there are no human player slots",
    });
  }

  const expectedConfigurableSeats = Math.max(
    0,
    humanPlayerSlots - (value.creatorRole === "player" ? 1 : 0),
  );
  if (value.humanSeats.length !== expectedConfigurableSeats) {
    context.addIssue({
      code: "custom",
      path: ["humanSeats"],
      message: `Expected ${expectedConfigurableSeats} human seat instructions`,
    });
  }

  const invitedPlatformUsers = value.humanSeats
    .filter((seat): seat is z.infer<typeof platformSeatInstructionSchema> => seat.mode === "platform_user")
    .map((seat) => seat.userId);
  if (new Set(invitedPlatformUsers).size !== invitedPlatformUsers.length) {
    context.addIssue({
      code: "custom",
      path: ["humanSeats"],
      message: "Platform user invites must target unique users",
    });
  }

  if (value.opponents.length > value.aiPlayerSlots) {
    context.addIssue({
      code: "custom",
      path: ["opponents"],
      message: "AI opponent profiles cannot exceed AI player slots",
    });
  }
});

type HumanSeatInstruction = z.infer<typeof humanSeatInstructionSchema>;
type OpponentProfileInput = z.infer<typeof opponentSchema>;

type TemplateSummary = {
  id: string;
  creator_id: string;
  is_public: boolean;
  name: string;
  objective: string;
  category: "structural" | "functional" | "process" | "uncategorized";
};

type SlotInsertPlan = {
  slot_index: number;
  seat_type: "human" | "ai";
  state: "open" | "invited" | "filled";
  assigned_user_id: string | null;
  ai_profile: Record<string, unknown> | null;
  invite:
    | {
        channel: "platform_search" | "email";
        invited_user_id: string | null;
        invited_email: string | null;
      }
    | null;
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

async function createFallbackTeamForActor(actorId: string) {
  const { data: actorUser, error: actorUserError } = await supabaseAdmin
    .from("users")
    .select("name")
    .eq("id", actorId)
    .maybeSingle();

  if (actorUserError) {
    return { response: jsonDbError("Failed to load actor profile for fallback team", actorUserError) };
  }

  const actorName =
    typeof actorUser?.name === "string" && actorUser.name.trim()
      ? actorUser.name.trim()
      : "My";
  const fallbackName = `${actorName}'s team`;

  const { data: teamRow, error: createTeamError } = await supabaseAdmin
    .from("teams")
    .insert({
      name: fallbackName,
    })
    .select("id")
    .single();

  if (createTeamError) {
    return { response: jsonDbError("Failed to create fallback team", createTeamError) };
  }

  const { error: membershipError } = await supabaseAdmin
    .from("team_members")
    .insert({
      team_id: teamRow.id,
      user_id: actorId,
      role: "manager",
    });

  if (membershipError) {
    return { response: jsonDbError("Failed to add actor to fallback team", membershipError) };
  }

  return { teamId: teamRow.id };
}

async function resolveTeamId(actorId: string, requestedTeamId?: string) {
  if (requestedTeamId) {
    const membership = await ensureActorCanAccessTeam(requestedTeamId, actorId);
    if ("response" in membership) {
      return { response: membership.response };
    }
    return { teamId: requestedTeamId };
  }

  const { data: membershipRows, error: membershipError } = await supabaseAdmin
    .from("team_members")
    .select("team_id")
    .eq("user_id", actorId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(1);

  if (membershipError) {
    return { response: jsonDbError("Failed to resolve actor team", membershipError) };
  }

  const fallbackTeamId = membershipRows?.[0]?.team_id;
  if (typeof fallbackTeamId === "string" && fallbackTeamId) {
    return { teamId: fallbackTeamId };
  }

  return createFallbackTeamForActor(actorId);
}

async function rollbackCreatedGame(gameId: string) {
  await supabaseAdmin.from("woi_games").delete().eq("id", gameId);
}

function hashJoinToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

function buildSlotPlans(input: {
  actorId: string;
  creatorRole: "player" | "viewer";
  totalPlayerSlots: number;
  aiPlayerSlots: number;
  humanSeats: HumanSeatInstruction[];
  opponents: OpponentProfileInput[];
}): SlotInsertPlan[] {
  const humanPlayerSlots = input.totalPlayerSlots - input.aiPlayerSlots;
  const plans: SlotInsertPlan[] = [];

  let humanSlotIndex = 1;
  if (input.creatorRole === "player") {
    plans.push({
      slot_index: humanSlotIndex,
      seat_type: "human",
      state: "filled",
      assigned_user_id: input.actorId,
      ai_profile: null,
      invite: null,
    });
    humanSlotIndex += 1;
  }

  for (const seat of input.humanSeats) {
    if (seat.mode === "platform_user") {
      plans.push({
        slot_index: humanSlotIndex,
        seat_type: "human",
        state: "invited",
        assigned_user_id: null,
        ai_profile: null,
        invite: {
          channel: "platform_search",
          invited_user_id: seat.userId,
          invited_email: null,
        },
      });
    } else if (seat.mode === "email") {
      plans.push({
        slot_index: humanSlotIndex,
        seat_type: "human",
        state: "invited",
        assigned_user_id: null,
        ai_profile: null,
        invite: {
          channel: "email",
          invited_user_id: null,
          invited_email: seat.email,
        },
      });
    } else {
      plans.push({
        slot_index: humanSlotIndex,
        seat_type: "human",
        state: "open",
        assigned_user_id: null,
        ai_profile: null,
        invite: null,
      });
    }
    humanSlotIndex += 1;
  }

  const aiPlayerSlots = input.aiPlayerSlots;
  for (let aiIndex = 0; aiIndex < aiPlayerSlots; aiIndex += 1) {
    const slotIndex = humanPlayerSlots + aiIndex + 1;
    const opponent = input.opponents[aiIndex];
    plans.push({
      slot_index: slotIndex,
      seat_type: "ai",
      state: "filled",
      assigned_user_id: null,
      ai_profile: opponent
        ? {
            label: opponent.codename,
            codename: opponent.codename,
            narrative: opponent.narrative,
            intelligence: opponent.intelligence,
            difficulty: opponent.difficulty,
            imageUrl: opponent.imageUrl,
          }
        : {
            label: `AI Player ${aiIndex + 1}`,
          },
      invite: null,
    });
  }

  return plans;
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

  const parsedBody = createWithSlotsSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("Invalid request body", {
      status: 400,
      code: "INVALID_BODY",
      details: parsedBody.error.flatten(),
    });
  }

  const teamResolution = await resolveTeamId(actor.actorId, parsedBody.data.teamId);
  if ("response" in teamResolution) {
    return teamResolution.response;
  }

  const invitedPlatformUserIds = parsedBody.data.humanSeats
    .filter((seat): seat is z.infer<typeof platformSeatInstructionSchema> => seat.mode === "platform_user")
    .map((seat) => seat.userId);
  if (
    parsedBody.data.creatorRole === "player"
    && invitedPlatformUserIds.some((userId) => userId === actor.actorId)
  ) {
    return jsonError("Creator already occupies a player seat and cannot be invited again", {
      status: 400,
      code: "DUPLICATE_CREATOR_SEAT",
    });
  }

  if (invitedPlatformUserIds.length > 0) {
    const { data: existingUsers, error: usersError } = await supabaseAdmin
      .from("users")
      .select("id")
      .in("id", invitedPlatformUserIds);

    if (usersError) {
      return jsonDbError("Failed to validate platform invite users", usersError);
    }

    const existing = new Set((existingUsers ?? []).map((row) => row.id));
    const missing = invitedPlatformUserIds.filter((userId) => !existing.has(userId));
    if (missing.length > 0) {
      return jsonError("One or more invited platform users were not found", {
        status: 400,
        code: "INVALID_PLATFORM_USER",
        details: { missingUserIds: missing },
      });
    }
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

  if (parsedBody.data.presetId) {
    const presetResult = await supabaseAdmin
      .from("woi_roster_presets")
      .select("id", { head: true, count: "exact" })
      .eq("id", parsedBody.data.presetId)
      .eq("owner_user_id", actor.actorId);

    if (presetResult.error && presetResult.error.code !== "42P01") {
      return jsonDbError("Failed to validate roster preset", presetResult.error);
    }
    if (presetResult.error && presetResult.error.code === "42P01") {
      return jsonError("Roster presets are unavailable in this environment", {
        status: 409,
        code: "PRESET_UNAVAILABLE",
      });
    }
    if ((presetResult.count ?? 0) === 0) {
      return jsonError("Roster preset not found", {
        status: 404,
        code: "PRESET_NOT_FOUND",
      });
    }
  }

  const slotPlans = buildSlotPlans({
    actorId: actor.actorId,
    creatorRole: parsedBody.data.creatorRole,
    totalPlayerSlots: parsedBody.data.totalPlayerSlots,
    aiPlayerSlots: parsedBody.data.aiPlayerSlots,
    humanSeats: parsedBody.data.humanSeats,
    opponents: parsedBody.data.opponents,
  });

  const lifecycle = resolveCreateWithSlotsLifecycle();
  const humanSlots = slotPlans.filter((slot) => slot.seat_type === "human");
  const firstFilledHumanSeat = humanSlots.find((slot) => slot.state === "filled");
  const currentPlayerId =
    firstFilledHumanSeat?.assigned_user_id
    ?? (parsedBody.data.creatorRole === "player" ? actor.actorId : null);

  const { data: createdGame, error: createGameError } = await supabaseAdmin
    .from("woi_games")
    .insert({
      template_id: parsedBody.data.templateId,
      team_id: teamResolution.teamId,
      creator_id: actor.actorId,
      question: parsedBody.data.question,
      description: parsedBody.data.description,
      is_public: parsedBody.data.isPublic,
      status: lifecycle.status,
      current_player_id: currentPlayerId,
      total_player_slots: parsedBody.data.totalPlayerSlots,
      ai_player_slots: parsedBody.data.aiPlayerSlots,
      lobby_visibility: parsedBody.data.lobbyVisibility,
      join_link_enabled: parsedBody.data.joinLinkEnabled,
      creator_role: parsedBody.data.creatorRole,
      seat_claims_locked: lifecycle.seatClaimsLocked,
    })
    .select(WOI_GAME_SELECT_COLUMNS)
    .single();

  if (createGameError) {
    return jsonDbError("Failed to create game", createGameError);
  }

  const slotInsertPayload = slotPlans.map((slot) => ({
    game_id: createdGame.id,
    slot_index: slot.slot_index,
    seat_type: slot.seat_type,
    state: slot.state,
    assigned_user_id: slot.assigned_user_id,
    ai_profile: slot.ai_profile,
  }));

  const { data: slotsData, error: createSlotsError } = await supabaseAdmin
    .from("woi_game_slots")
    .insert(slotInsertPayload)
    .select("id,game_id,slot_index,seat_type,state,assigned_user_id,ai_profile,created_at,updated_at");

  if (createSlotsError) {
    await rollbackCreatedGame(createdGame.id);
    return jsonDbError("Failed to create game slots", createSlotsError);
  }

  const createdSlots = (slotsData ?? []) as WoiGameSlotRow[];
  const slotsByIndex = new Map(createdSlots.map((slot) => [slot.slot_index, slot]));

  const inviteInsertPayload = slotPlans
    .map((slot) => {
      if (!slot.invite) {
        return null;
      }
      const insertedSlot = slotsByIndex.get(slot.slot_index);
      if (!insertedSlot) {
        return null;
      }
      return {
        game_id: createdGame.id,
        slot_id: insertedSlot.id,
        channel: slot.invite.channel,
        invited_user_id: slot.invite.invited_user_id,
        invited_email: slot.invite.invited_email,
        status: "pending",
        created_by: actor.actorId,
      };
    })
    .filter((invite): invite is NonNullable<typeof invite> => Boolean(invite));

  let createdInvites: WoiGameInviteRow[] = [];
  if (inviteInsertPayload.length > 0) {
    const { data: invitesData, error: createInvitesError } = await supabaseAdmin
      .from("woi_game_invites")
      .insert(inviteInsertPayload)
      .select(
        "id,game_id,slot_id,channel,invited_user_id,invited_email,token_hash,status,expires_at,accepted_by_user_id,accepted_at,created_by,created_at,updated_at",
      );

    if (createInvitesError) {
      await rollbackCreatedGame(createdGame.id);
      return jsonDbError("Failed to create seat invites", createInvitesError);
    }

    createdInvites = (invitesData ?? []) as WoiGameInviteRow[];
  }

  if (parsedBody.data.aiPlayerSlots > 0) {
    const persistedOpponents = parsedBody.data.opponents
      .slice(0, parsedBody.data.aiPlayerSlots)
      .map((opponent) => ({
        codename: opponent.codename,
        narrative: opponent.narrative,
        intelligence: opponent.intelligence,
        difficulty: opponent.difficulty,
        imageUrl: opponent.imageUrl,
      }));

    const { error: persistAiProfilesError } = await supabaseAdmin
      .from("woi_game_ai_profiles")
      .upsert(
        {
          game_id: createdGame.id,
          ai_player_count: parsedBody.data.aiPlayerSlots,
          opponents: persistedOpponents,
          created_by: actor.actorId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "game_id" },
      );

    if (persistAiProfilesError && persistAiProfilesError.code !== "42P01") {
      await rollbackCreatedGame(createdGame.id);
      return jsonDbError("Failed to persist AI profiles", persistAiProfilesError);
    }
  }

  let joinLink: {
    id: string;
    status: "active" | "revoked" | "expired" | "unavailable";
    token: string | null;
    shareUrl: string | null;
  } | null = null;

  if (parsedBody.data.joinLinkEnabled) {
    const rawToken = randomBytes(20).toString("hex");
    const tokenHash = hashJoinToken(rawToken);
    const { data: joinLinkRow, error: joinLinkError } = await supabaseAdmin
      .from("woi_game_join_links")
      .insert({
        game_id: createdGame.id,
        token_hash: tokenHash,
        status: "active",
        created_by: actor.actorId,
      })
      .select("id,status")
      .single();

    if (joinLinkError && joinLinkError.code !== "42P01") {
      await rollbackCreatedGame(createdGame.id);
      return jsonDbError("Failed to create join link", joinLinkError);
    }

    if (joinLinkRow) {
      const requestOrigin = new URL(request.url).origin;
      joinLink = {
        id: joinLinkRow.id,
        status: joinLinkRow.status,
        token: rawToken,
        shareUrl: `${requestOrigin}/woi/join/${createdGame.id}?token=${encodeURIComponent(rawToken)}`,
      };
    } else {
      joinLink = {
        id: "",
        status: "unavailable",
        token: null,
        shareUrl: null,
      };
    }
  }

  const invitesBySlotId = new Map(createdInvites.map((invite) => [invite.slot_id, invite]));
  const slotsResponse = createdSlots
    .sort((left, right) => left.slot_index - right.slot_index)
    .map((slot) => {
      const invite = invitesBySlotId.get(slot.id);
      return {
        id: slot.id,
        slotIndex: slot.slot_index,
        seatType: slot.seat_type,
        state: slot.state,
        assignedUserId: slot.assigned_user_id,
        aiProfile: slot.ai_profile,
        invite: invite
          ? {
              id: invite.id,
              channel: invite.channel,
              status: invite.status,
              invitedUserId: invite.invited_user_id,
              invitedEmail: invite.invited_email,
            }
          : null,
      };
    });

  const inviteSummary = {
    total: createdInvites.length,
    pending: createdInvites.filter((invite) =>
      invite.status === "pending" || invite.status === "sent").length,
    byChannel: {
      platform_search: createdInvites.filter((invite) => invite.channel === "platform_search").length,
      email: createdInvites.filter((invite) => invite.channel === "email").length,
      join_link: createdInvites.filter((invite) => invite.channel === "join_link").length,
    },
  };

  return jsonSuccess(
    {
      game: createdGame as WoiGameRow,
      status: createdGame.status,
      slots: slotsResponse,
      inviteSummary,
      viewerSummary: {
        activeCount: 0,
        creatorRole: parsedBody.data.creatorRole,
      },
      joinLink,
      appliedPresetId: parsedBody.data.presetId ?? null,
      template: template as TemplateSummary,
    },
    { status: 201 },
  );
}
