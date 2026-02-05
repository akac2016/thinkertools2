import "server-only";

import { jsonError, jsonSuccess } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const startedAt = Date.now();

  const { count, error } = await supabaseAdmin
    .from("users")
    .select("id", { head: true, count: "exact" });

  if (error) {
    return jsonError("Database health check failed", {
      status: 503,
      code: "DB_UNAVAILABLE",
      details: {
        message: error.message,
      },
    });
  }

  return jsonSuccess(
    {
      status: "ok",
      database: "connected",
      usersCount: count ?? 0,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
    },
    {
      status: 200,
    },
  );
}
