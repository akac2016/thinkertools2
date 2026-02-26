import "server-only";

import { jsonError, jsonSuccess } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireActorIdFromRequest } from "@/lib/auth/actor";

export async function GET(request: Request) {
  const actor = await requireActorIdFromRequest(request);
  if (!actor.ok) {
    return actor.response;
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id,username,name,email")
    .eq("id", actor.actorId)
    .maybeSingle();

  if (error) {
    return jsonError("Failed to load authenticated profile", {
      status: 500,
      code: "PROFILE_LOAD_FAILED",
      details: {
        dbCode: error.code ?? null,
        dbMessage: error.message,
      },
    });
  }

  if (!data) {
    return jsonError("Authenticated profile not found", {
      status: 404,
      code: "PROFILE_NOT_FOUND",
    });
  }

  return jsonSuccess({
    id: data.id,
    username: data.username,
    name: data.name,
    email: data.email,
  });
}
