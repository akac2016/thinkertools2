import "server-only";

import { z } from "zod";

import { parseBody, unexpectedError } from "@/lib/api/route-utils";
import { requireActorIdFromRequest } from "@/lib/auth/actor";
import { jsonSuccess } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";

// GET /api/thinkertools-missions-create/trainings
// Returns all active trainings so the educator can pick one or create a new one.
export async function GET(request: Request) {
  try {
    const actor = await requireActorIdFromRequest(request);
    if (!actor.ok) return actor.response;

    const { data, error } = await supabaseAdmin
      .from("trainings")
      .select("id, slug, title, description, is_active")
      .order("title", { ascending: true });

    if (error) throw new Error(error.message);

    return jsonSuccess({ trainings: data ?? [] });
  } catch (error) {
    return unexpectedError("Failed to list trainings", error);
  }
}

const createTrainingSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(600).optional(),
});

// POST /api/thinkertools-missions-create/trainings
// Creates a new training track. Any authenticated educator can do this.
export async function POST(request: Request) {
  try {
    const actor = await requireActorIdFromRequest(request);
    if (!actor.ok) return actor.response;

    const parsed = await parseBody(request, createTrainingSchema);
    if (!parsed.ok) return parsed.response;

    const { title, description } = parsed.data;

    // Derive a slug from the title
    const slug = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      || `training-${Date.now()}`;

    // De-duplicate slug
    let finalSlug = slug;
    for (let i = 2; i <= 20; i++) {
      const { data: existing } = await supabaseAdmin
        .from("trainings")
        .select("id")
        .eq("slug", finalSlug)
        .maybeSingle();
      if (!existing) break;
      finalSlug = `${slug}-${i}`;
    }

    const { data, error } = await supabaseAdmin
      .from("trainings")
      .insert({
        slug: finalSlug,
        title,
        description: description ?? "",
        max_level: 20,
        is_active: true,
      })
      .select("id, slug, title, description, is_active")
      .single();

    if (error) throw new Error(error.message);

    return jsonSuccess({ training: data }, { status: 201 });
  } catch (error) {
    return unexpectedError("Failed to create training", error);
  }
}
