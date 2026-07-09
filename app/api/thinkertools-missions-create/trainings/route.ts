import "server-only";

import { z } from "zod";

import { parseBody, unexpectedError } from "@/lib/api/route-utils";
import { requireActorIdFromRequest } from "@/lib/auth/actor";
import { jsonSuccess } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";

// GET /api/thinkertools-missions-create/trainings
// Returns all trainings with metadata about whether they're empty (no related content).
// Empty trainings should show in drafts regardless of publication_status.
export async function GET(request: Request) {
  try {
    const actor = await requireActorIdFromRequest(request);
    if (!actor.ok) return actor.response;

    const { data: trainings, error } = await supabaseAdmin
      .from("trainings")
      .select("id, slug, title, description, publication_status")
      .order("title", { ascending: true });

    if (error) throw new Error(error.message);

    if (!trainings || trainings.length === 0) {
      return jsonSuccess({ trainings: [] });
    }

    // Check if each training has related content
    const trainingsWithMetadata = await Promise.all(
      trainings.map(async (training) => {
        const [groupsResult, activitiesResult, missionsResult, draftsResult, attemptsResult, completionsResult] = await Promise.all([
          supabaseAdmin
            .from("training_activity_groups")
            .select("id", { count: "exact", head: true })
            .eq("training_id", training.id),
          supabaseAdmin
            .from("training_activities")
            .select("id", { count: "exact", head: true })
            .eq("primary_training_id", training.id)
            .eq("publication_status", "live"),
          supabaseAdmin
            .from("missions")
            .select("id", { count: "exact", head: true })
            .eq("primary_training_id", training.id)
            .eq("publication_status", "live"),
          supabaseAdmin
            .from("content_drafts")
            .select("id", { count: "exact", head: true })
            .eq("primary_training_id", training.id),
          supabaseAdmin
            .from("training_activity_attempts")
            .select("id", { count: "exact", head: true })
            .eq("training_id", training.id),
          supabaseAdmin
            .from("mission_completions")
            .select("id", { count: "exact", head: true })
            .eq("training_id", training.id),
        ]);

        const hasGroups = (groupsResult.count ?? 0) > 0;
        const hasActivities = (activitiesResult.count ?? 0) > 0;
        const hasMissions = (missionsResult.count ?? 0) > 0;
        const hasDrafts = (draftsResult.count ?? 0) > 0;
        const hasAttempts = (attemptsResult.count ?? 0) > 0;
        const hasCompletions = (completionsResult.count ?? 0) > 0;
        const hasReleasableContent = hasActivities || hasMissions;

        const hasPublishedContent =
          hasGroups || hasActivities || hasMissions || hasAttempts || hasCompletions;
        const isDraftOnly = !hasPublishedContent && hasDrafts;
        const isEmpty = !hasPublishedContent && !hasDrafts;

        return {
          ...training,
          isEmpty,
          isDraftOnly,
          hasReleasableContent,
        };
      })
    );

    return jsonSuccess({ trainings: trainingsWithMetadata });
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
        publication_status: "pending",
      })
      .select("id, slug, title, description, publication_status")
      .single();

    if (error) throw new Error(error.message);

    return jsonSuccess(
      {
        training: {
          ...data,
          isEmpty: true,
          isDraftOnly: false,
          hasReleasableContent: false,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return unexpectedError("Failed to create training", error);
  }
}
