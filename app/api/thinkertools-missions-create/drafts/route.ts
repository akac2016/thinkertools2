import "server-only";

import { z } from "zod";

import { parseBody, unexpectedError } from "@/lib/api/route-utils";
import { requireActorIdFromRequest } from "@/lib/auth/actor";
import type { ContentDraft } from "@/lib/authoring/draft-types";
import { createDraft, listDraftsByCreator, updateDraft } from "@/lib/authoring/server";
import { validateDraft } from "@/lib/authoring/validation";
import { jsonSuccess } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";

const createDraftBodySchema = z.object({
  contentType: z.enum(["activity", "mission"]),
  primaryTrainingId: z.string().uuid(),
  activityGroupId: z.string().uuid().nullable().optional(),
  title: z.string().trim().max(300).optional(),
  body: z.record(z.string(), z.unknown()).optional(),
  slug: z.string().trim().min(1).max(200).nullable().optional(),
});

async function enrichDraftMetadata(drafts: ContentDraft[]): Promise<ContentDraft[]> {
  if (drafts.length === 0) return drafts;

  const trainingIds = Array.from(new Set(drafts.map((d) => d.primaryTrainingId).filter(Boolean)));
  const activityGroupIds = Array.from(
    new Set(
      drafts
        .map((d) => d.activityGroupId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );

  const [trainingResult, groupResult] = await Promise.all([
    trainingIds.length > 0
      ? supabaseAdmin
          .from("trainings")
          .select("id, title")
          .in("id", trainingIds)
      : Promise.resolve({ data: [], error: null }),
    activityGroupIds.length > 0
      ? supabaseAdmin
          .from("training_activity_groups")
          .select("id, title")
          .in("id", activityGroupIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const trainingById = new Map((trainingResult.data ?? []).map((row) => [row.id, row.title]));
  const groupById = new Map((groupResult.data ?? []).map((row) => [row.id, row.title]));

  return drafts.map((draft) => ({
    ...draft,
    trainingTitle: trainingById.get(draft.primaryTrainingId) ?? null,
    activityGroupTitle: draft.activityGroupId ? groupById.get(draft.activityGroupId) ?? null : null,
  }));
}

// GET /api/thinkertools-missions-create/drafts
// Returns all non-archived drafts belonging to the authenticated actor.
export async function GET(request: Request) {
  try {
    const actor = await requireActorIdFromRequest(request);
    if (!actor.ok) {
      return actor.response;
    }

    const drafts = await listDraftsByCreator(actor.actorId);

    // Exclude archived drafts from the listing
    const visible = drafts.filter((d) => d.status !== "archived");

    const enriched = await enrichDraftMetadata(visible);
    return jsonSuccess({ drafts: enriched }, { status: 200 });
  } catch (error) {
    return unexpectedError("Failed to list drafts", error);
  }
}

// POST /api/thinkertools-missions-create/drafts
// Creates a manual draft from the supplied fields. No AI involvement.
export async function POST(request: Request) {
  try {
    const actor = await requireActorIdFromRequest(request);
    if (!actor.ok) {
      return actor.response;
    }

    const parsedBody = await parseBody(request, createDraftBodySchema);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { contentType, primaryTrainingId, activityGroupId, title, body, slug } = parsedBody.data;

    const draftBody = body ?? {};
    const validationIssues = validateDraft(contentType, draftBody);
    const status = validationIssues.length === 0 ? "valid" : "draft";

    const draft = await createDraft({
      contentType,
      origin: "manual",
      primaryTrainingId,
      activityGroupId: activityGroupId ?? null,
      title: title ?? "",
      body: draftBody,
      slug: slug ?? null,
      validationIssues,
      createdBy: actor.actorId,
    });

    // createDraft always inserts with status='draft'; promote to 'valid' if needed
    const finalDraft =
      status === "valid"
        ? await updateDraft(draft.id, { status: "valid" })
        : draft;

    return jsonSuccess({ draft: finalDraft }, { status: 201 });
  } catch (error) {
    return unexpectedError("Failed to create draft", error);
  }
}
