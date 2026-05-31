import "server-only";

import { requireActorIdFromRequest } from "@/lib/auth/actor";
import { jsonSuccess } from "@/lib/http";
import { getKaneStatus } from "@/lib/kane/process-registry";

export async function GET(request: Request) {
  const actor = await requireActorIdFromRequest(request);
  if (!actor.ok) {
    return actor.response;
  }

  return jsonSuccess(await getKaneStatus());
}
