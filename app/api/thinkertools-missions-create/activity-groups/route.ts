import "server-only";

import { z } from "zod";

import { parseBody, unexpectedError } from "@/lib/api/route-utils";
import { requireActorIdFromRequest } from "@/lib/auth/actor";
import { jsonSuccess } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";

// GET /api/thinkertools-missions-create/activity-groups?trainingId=<uuid>
// Returns all active activity groups for a given training.
export async function GET(request: Request) {
  try {
    const actor = await requireActorIdFromRequest(request);
    if (!actor.ok) return actor.response;

    const url = new URL(request.url);
    const trainingId = url.searchParams.get("trainingId");

    const query = supabaseAdmin
      .from("training_activity_groups")
      .select("id, slug, title, description, training_id, template_family, display_order")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("title", { ascending: true });

    if (trainingId) {
      query.eq("training_id", trainingId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return jsonSuccess({ groups: data ?? [] });
  } catch (error) {
    return unexpectedError("Failed to list activity groups", error);
  }
}

const createGroupSchema = z.object({
  trainingId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(600).optional(),
});

// POST /api/thinkertools-missions-create/activity-groups
// Creates a new activity group for a training.
export async function POST(request: Request) {
  try {
    const actor = await requireActorIdFromRequest(request);
    if (!actor.ok) return actor.response;

    const parsed = await parseBody(request, createGroupSchema);
    if (!parsed.ok) return parsed.response;

    const { trainingId, title, description } = parsed.data;

    // Derive slug from title
    const baseSlug = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      || `group-${Date.now()}`;

    // De-duplicate slug
    let finalSlug = baseSlug;
    for (let i = 2; i <= 20; i++) {
      const { data: existing } = await supabaseAdmin
        .from("training_activity_groups")
        .select("id")
        .eq("slug", finalSlug)
        .maybeSingle();
      if (!existing) break;
      finalSlug = `${baseSlug}-${i}`;
    }

    // Derive a template_family from the slug for new groups
    const templateFamily = finalSlug.replace(/-/g, "_");

    const { data, error } = await supabaseAdmin
      .from("training_activity_groups")
      .insert({
        slug: finalSlug,
        title,
        description: description ?? "",
        training_id: trainingId,
        template_family: templateFamily,
        is_active: true,
      })
      .select("id, slug, title, description, training_id, template_family, display_order")
      .single();

    if (error) throw new Error(error.message);

    return jsonSuccess({ group: data }, { status: 201 });
  } catch (error) {
    return unexpectedError("Failed to create activity group", error);
  }
}
