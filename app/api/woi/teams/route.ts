import "server-only";

import { jsonDbError, requireActorId, uniqueIds } from "@/lib/woi";
import { jsonSuccess } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";

type TeamMemberRow = {
  team_id: string;
};

type TeamRow = {
  id: string;
  name: string;
  created_at: string;
};

export async function GET(request: Request) {
  const actor = requireActorId(request);
  if ("response" in actor) {
    return actor.response;
  }

  const { data: membershipData, error: membershipError } = await supabaseAdmin
    .from("team_members")
    .select("team_id")
    .eq("user_id", actor.actorId)
    .order("created_at", { ascending: true });

  if (membershipError) {
    return jsonDbError("Failed to load team memberships", membershipError);
  }

  const teamIds = uniqueIds(((membershipData ?? []) as TeamMemberRow[]).map((member) => member.team_id));
  if (teamIds.length === 0) {
    return jsonSuccess({ teams: [] }, { status: 200 });
  }

  const { data: teamsData, error: teamsError } = await supabaseAdmin
    .from("teams")
    .select("id,name,created_at")
    .in("id", teamIds)
    .order("name", { ascending: true });

  if (teamsError) {
    return jsonDbError("Failed to load teams", teamsError);
  }

  return jsonSuccess(
    {
      teams: ((teamsData ?? []) as TeamRow[]).map((team) => ({
        id: team.id,
        name: team.name,
        created_at: team.created_at,
      })),
    },
    { status: 200 },
  );
}
