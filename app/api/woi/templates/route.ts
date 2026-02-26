import "server-only";

import { jsonSuccess } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { jsonDbError, requireActorId } from "@/lib/woi";

type TemplateRow = {
  id: string;
  name: string;
  objective: string;
  category: "structural" | "functional" | "process" | "uncategorized";
  is_public: boolean;
  creator_id: string;
  updated_at: string;
};

export async function GET(request: Request) {
  const actor = await requireActorId(request);
  if ("response" in actor) {
    return actor.response;
  }

  const { data, error } = await supabaseAdmin
    .from("woi_templates")
    .select("id,name,objective,category,is_public,creator_id,updated_at")
    .or(`is_public.eq.true,creator_id.eq.${actor.actorId}`)
    .order("updated_at", { ascending: false });

  if (error) {
    return jsonDbError("Failed to load templates", error);
  }

  return jsonSuccess(
    {
      templates: ((data ?? []) as TemplateRow[]).map((template) => ({
        id: template.id,
        name: template.name,
        objective: template.objective,
        category: template.category,
        is_public: template.is_public,
        creator_id: template.creator_id,
        updated_at: template.updated_at,
      })),
    },
    { status: 200 },
  );
}
