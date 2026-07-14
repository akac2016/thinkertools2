import "server-only";

import { z } from "zod";

import { parseBody, unexpectedError } from "@/lib/api/route-utils";
import { requireActorIdFromRequest } from "@/lib/auth/actor";
import { jsonSuccess } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";

type ActivityGroupRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  training_id: string;
  template_family: string;
  display_order: number;
};

function normalizeTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

const GROUP_SELECT = "id, slug, title, description, training_id, template_family, display_order";

// GET /api/thinkertools-missions-create/activity-groups?trainingId=<uuid>
// Returns all non-archived activity groups for authoring, including pending
// draft categories that are not yet visible to learners.
export async function GET(request: Request) {
  try {
    const actor = await requireActorIdFromRequest(request);
    if (!actor.ok) return actor.response;

    const url = new URL(request.url);
    const trainingId = url.searchParams.get("trainingId");

    const query = supabaseAdmin
      .from("training_activity_groups")
      .select(GROUP_SELECT)
      .neq("publication_status", "archived")
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
    const normalizedTitle = normalizeTitle(title);

    const { data: existingGroups, error: existingError } = await supabaseAdmin
      .from("training_activity_groups")
      .select(GROUP_SELECT)
      .eq("training_id", trainingId)
      .neq("publication_status", "archived");

    if (existingError) throw new Error(existingError.message);

    const existingGroup = ((existingGroups ?? []) as ActivityGroupRow[]).find(
      (group) => normalizeTitle(group.title) === normalizedTitle,
    );

    if (existingGroup) {
      return jsonSuccess({ group: existingGroup }, { status: 200 });
    }

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
        publication_status: "pending",
      })
      .select(GROUP_SELECT)
      .single();

    if (error) throw new Error(error.message);

    return jsonSuccess({ group: data }, { status: 201 });
  } catch (error) {
    return unexpectedError("Failed to create activity group", error);
  }
}
