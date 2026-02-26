import "server-only";

import { z } from "zod";

import { jsonError, jsonSuccess } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getTeamMembersOrdered,
  getUsersByIds,
  isTeamMember,
  jsonDbError,
  requireActorId,
} from "@/lib/woi";

const querySchema = z.object({
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
});

type PresetRow = {
  id: string;
  team_id: string | null;
  name: string;
  source_game_id: string | null;
  slots: unknown[];
  updated_at: string;
};

type TeamRow = {
  id: string;
  name: string;
};

type PresetSeat = {
  mode: "platform_user" | "email" | "open";
  userId?: string;
  email?: string;
};

function readString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function normalizePresetSeat(value: unknown): PresetSeat | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;

  const seatType = readString(record, ["seatType", "seat_type"]).toLowerCase();
  if (seatType === "ai") {
    return null;
  }

  const mode = readString(record, ["mode", "channel"]).toLowerCase();
  const userId = readString(record, ["userId", "user_id", "assigned_user_id", "invited_user_id"]);
  const email = readString(record, ["email", "invited_email"]);
  const state = readString(record, ["state"]).toLowerCase();

  if (mode === "platform_user" || mode === "platform_search" || userId) {
    if (!userId) {
      return null;
    }
    return {
      mode: "platform_user",
      userId,
    };
  }

  if (mode === "email" || email) {
    if (!email) {
      return null;
    }
    return {
      mode: "email",
      email,
    };
  }

  if (
    mode === "open"
    || mode === "open_lobby"
    || mode === "join_link"
    || state === "open"
    || state === "released"
  ) {
    return {
      mode: "open",
    };
  }

  return null;
}

export async function GET(request: Request) {
  const actor = await requireActorId(request);
  if ("response" in actor) {
    return actor.response;
  }

  const parsedQuery = querySchema.safeParse({
    teamId: new URL(request.url).searchParams.get("teamId"),
  });
  if (!parsedQuery.success) {
    return jsonError("Invalid query parameters", {
      status: 400,
      code: "INVALID_QUERY",
      details: parsedQuery.error.flatten(),
    });
  }

  let teamPreset: {
    id: string;
    name: string;
    teamId: string | null;
    entries: Array<PresetSeat & { userName?: string; userEmail?: string | null }>;
  } | null = null;

  let teamMemberUserIds: string[] = [];
  let teamName: string | null = null;

  if (parsedQuery.data.teamId) {
    const membership = await isTeamMember(parsedQuery.data.teamId, actor.actorId);
    if ("response" in membership) {
      return membership.response;
    }
    if (!membership.isMember) {
      return jsonError("You are not a member of this team", {
        status: 403,
        code: "TEAM_FORBIDDEN",
      });
    }

    const membersResult = await getTeamMembersOrdered(parsedQuery.data.teamId);
    if ("response" in membersResult) {
      return membersResult.response;
    }
    teamMemberUserIds = membersResult.members.map((member) => member.user_id);

    const { data: teamRow, error: teamError } = await supabaseAdmin
      .from("teams")
      .select("id,name")
      .eq("id", parsedQuery.data.teamId)
      .maybeSingle();
    if (teamError) {
      return jsonDbError("Failed to load team details", teamError);
    }
    teamName = (teamRow as TeamRow | null)?.name ?? null;
  }

  const presetsResult = await supabaseAdmin
    .from("woi_roster_presets")
    .select("id,team_id,name,source_game_id,slots,updated_at")
    .eq("owner_user_id", actor.actorId)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (presetsResult.error && presetsResult.error.code !== "42P01") {
    return jsonDbError("Failed to load roster presets", presetsResult.error);
  }

  const presets = presetsResult.error
    ? [] as PresetRow[]
    : ((presetsResult.data ?? []) as PresetRow[]);

  const presetSeatEntries = presets.map((preset) => ({
    ...preset,
    entries: (Array.isArray(preset.slots) ? preset.slots : [])
      .map((entry) => normalizePresetSeat(entry))
      .filter((entry): entry is PresetSeat => Boolean(entry)),
  }));

  const presetUserIds = presetSeatEntries.flatMap((preset) =>
    preset.entries
      .filter((entry) => entry.mode === "platform_user")
      .map((entry) => entry.userId ?? ""),
  );
  const userIds = Array.from(
    new Set(
      [...teamMemberUserIds, ...presetUserIds].filter((userId): userId is string => Boolean(userId)),
    ),
  );

  let usersById = new Map<string, { name: string; email: string | null }>();
  if (userIds.length > 0) {
    const usersResult = await getUsersByIds(userIds);
    if ("response" in usersResult) {
      return usersResult.response;
    }
    usersById = new Map(
      usersResult.users.map((user) => [user.id, { name: user.name, email: user.email }]),
    );
  }

  if (parsedQuery.data.teamId) {
    teamPreset = {
      id: `team:${parsedQuery.data.teamId}`,
      name: teamName ? `${teamName} team members` : "Team members",
      teamId: parsedQuery.data.teamId,
      entries: teamMemberUserIds.map((userId) => ({
        mode: "platform_user",
        userId,
        userName: usersById.get(userId)?.name,
        userEmail: usersById.get(userId)?.email ?? null,
      })),
    };
  }

  return jsonSuccess(
    {
      teamPreset,
      presets: presetSeatEntries.map((preset) => ({
        id: preset.id,
        name: preset.name,
        teamId: preset.team_id,
        sourceGameId: preset.source_game_id,
        updatedAt: preset.updated_at,
        entries: preset.entries.map((entry) => {
          if (entry.mode === "platform_user") {
            return {
              mode: entry.mode,
              userId: entry.userId,
              userName: entry.userId ? usersById.get(entry.userId)?.name : undefined,
              userEmail: entry.userId ? (usersById.get(entry.userId)?.email ?? null) : null,
            };
          }
          if (entry.mode === "email") {
            return {
              mode: entry.mode,
              email: entry.email,
            };
          }
          return {
            mode: "open" as const,
          };
        }),
      })),
    },
    { status: 200 },
  );
}
