import "server-only";

import { z } from "zod";

import { jsonError, jsonSuccess } from "@/lib/http";
import { takeInMemoryRateLimit } from "@/lib/api/in-memory-rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  isTeamMember,
  jsonDbError,
  requireActorId,
  uniqueIds,
} from "@/lib/woi";

const SEARCH_RATE_LIMIT_PER_MINUTE = 30;
const SEARCH_RATE_WINDOW_MS = 60_000;

const querySchema = z.object({
  q: z.string().trim().min(2).max(80),
  teamId: z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return undefined;
      }
      const trimmed = value.trim();
      return trimmed ? trimmed : undefined;
    },
    z.string().uuid().optional(),
  ),
});

type TeamMemberRow = {
  user_id: string;
};

type UserRow = {
  id: string;
  name: string;
  username: string;
  email: string | null;
  color: string;
};

function toSafeLikeTerm(value: string) {
  return value
    .replace(/[%,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET(request: Request) {
  const actor = await requireActorId(request);
  if ("response" in actor) {
    return actor.response;
  }

  const url = new URL(request.url);
  const parsedQuery = querySchema.safeParse({
    q: url.searchParams.get("q"),
    teamId: url.searchParams.get("teamId"),
  });

  if (!parsedQuery.success) {
    return jsonError("Invalid query parameters", {
      status: 400,
      code: "INVALID_QUERY",
      details: parsedQuery.error.flatten(),
    });
  }

  const rateLimit = takeInMemoryRateLimit({
    key: `woi:user-search:${actor.actorId}`,
    limit: SEARCH_RATE_LIMIT_PER_MINUTE,
    windowMs: SEARCH_RATE_WINDOW_MS,
  });
  if (!rateLimit.allowed) {
    return jsonError("Too many invite-target searches. Please try again shortly.", {
      status: 429,
      code: "RATE_LIMITED",
      details: {
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      headers: {
        "Retry-After": String(rateLimit.retryAfterSeconds),
        "X-RateLimit-Limit": String(SEARCH_RATE_LIMIT_PER_MINUTE),
        "X-RateLimit-Remaining": "0",
      },
    });
  }

  if (parsedQuery.data.teamId) {
    const membership = await isTeamMember(parsedQuery.data.teamId, actor.actorId);
    if ("response" in membership) {
      return membership.response;
    }
    if (!membership.isMember) {
      return jsonError("You are not allowed to search users for this team", {
        status: 403,
        code: "TEAM_FORBIDDEN",
      });
    }
  }

  const safeNeedle = toSafeLikeTerm(parsedQuery.data.q);
  if (!safeNeedle) {
    return jsonSuccess(
      {
        query: parsedQuery.data.q,
        users: [] as UserRow[],
      },
      {
        status: 200,
        headers: {
          "X-RateLimit-Limit": String(SEARCH_RATE_LIMIT_PER_MINUTE),
          "X-RateLimit-Remaining": String(rateLimit.remaining),
        },
      },
    );
  }

  let users: UserRow[] = [];

  if (parsedQuery.data.teamId) {
    const { data: teamMembersData, error: teamMembersError } = await supabaseAdmin
      .from("team_members")
      .select("user_id")
      .eq("team_id", parsedQuery.data.teamId);

    if (teamMembersError) {
      return jsonDbError("Failed to load team members", teamMembersError);
    }

    const memberIds = uniqueIds(((teamMembersData ?? []) as TeamMemberRow[]).map((member) => member.user_id));
    if (memberIds.length === 0) {
      return jsonSuccess(
        {
          query: parsedQuery.data.q,
          users: [] as UserRow[],
        },
        { status: 200 },
      );
    }

    const { data: usersData, error: usersError } = await supabaseAdmin
      .from("users")
      .select("id,name,username,email,color")
      .in("id", memberIds)
      .order("name", { ascending: true });

    if (usersError) {
      return jsonDbError("Failed to search users", usersError);
    }

    const normalizedNeedle = safeNeedle.toLowerCase();
    users = ((usersData ?? []) as UserRow[])
      .filter((user) => {
        const haystack = `${user.name} ${user.username} ${user.email ?? ""}`.toLowerCase();
        return haystack.includes(normalizedNeedle);
      })
      .slice(0, 12);
  } else {
    const like = `%${safeNeedle}%`;
    const { data: usersData, error: usersError } = await supabaseAdmin
      .from("users")
      .select("id,name,username,email,color")
      .or(`name.ilike.${like},username.ilike.${like},email.ilike.${like}`)
      .order("name", { ascending: true })
      .limit(12);

    if (usersError) {
      return jsonDbError("Failed to search users", usersError);
    }

    users = (usersData ?? []) as UserRow[];
  }

  return jsonSuccess(
    {
      query: parsedQuery.data.q,
      users: users.map((user) => ({
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        color: user.color,
      })),
    },
    {
      status: 200,
      headers: {
        "X-RateLimit-Limit": String(SEARCH_RATE_LIMIT_PER_MINUTE),
        "X-RateLimit-Remaining": String(rateLimit.remaining),
      },
    },
  );
}
