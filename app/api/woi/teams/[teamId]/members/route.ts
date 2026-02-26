import "server-only";

import { z } from "zod";

import { jsonError, jsonSuccess } from "@/lib/http";
import { getTeamMembersOrdered, getUsersByIds, isTeamMember, requireActorId } from "@/lib/woi";

const paramsSchema = z.object({
  teamId: z.string().uuid(),
});

type RouteContext = {
  params: Promise<{
    teamId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const actor = await requireActorId(request);
  if ("response" in actor) {
    return actor.response;
  }

  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return jsonError("Invalid team id", {
      status: 400,
      code: "INVALID_TEAM_ID",
      details: parsedParams.error.flatten(),
    });
  }

  const membership = await isTeamMember(parsedParams.data.teamId, actor.actorId);
  if ("response" in membership) {
    return membership.response;
  }
  if (!membership.isMember) {
    return jsonError("You are not a member of this team", {
      status: 403,
      code: "TEAM_FORBIDDEN",
    });
  }

  const membersResult = await getTeamMembersOrdered(parsedParams.data.teamId);
  if ("response" in membersResult) {
    return membersResult.response;
  }

  const usersResult = await getUsersByIds(
    membersResult.members.map((member) => member.user_id),
  );
  if ("response" in usersResult) {
    return usersResult.response;
  }

  const userById = new Map(usersResult.users.map((user) => [user.id, user]));

  return jsonSuccess(
    {
      teamId: parsedParams.data.teamId,
      members: membersResult.members.map((member) => ({
        id: member.id,
        role: member.role,
        createdAt: member.created_at,
        user: userById.get(member.user_id) ?? null,
      })),
    },
    { status: 200 },
  );
}
