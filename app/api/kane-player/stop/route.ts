import "server-only";

import { requireActorIdFromRequest } from "@/lib/auth/actor";
import { jsonSuccess } from "@/lib/http";
import { stopKaneProcess } from "@/lib/kane/process-registry";

export async function POST(request: Request) {
  const actor = await requireActorIdFromRequest(request);
  if (!actor.ok) {
    return actor.response;
  }

  const stopped = await stopKaneProcess();

  return jsonSuccess({ stopped: stopped > 0, count: stopped });
}
