import "server-only";

import { z } from "zod";

import { parseBody, unexpectedError } from "@/lib/api/route-utils";
import { requireActorIdFromRequest } from "@/lib/auth/actor";
import { createDraft, listDraftsByCreator, updateDraft } from "@/lib/authoring/server";
import { validateDraft } from "@/lib/authoring/validation";
import { jsonSuccess } from "@/lib/http";

const createDraftBodySchema = z.object({
  contentType: z.enum(["activity", "mission"]),
  primaryTrainingId: z.string().uuid(),
  activityGroupId: z.string().uuid().nullable().optional(),
  title: z.string().trim().max(300).optional(),
  body: z.record(z.string(), z.unknown()).optional(),
  slug: z.string().trim().min(1).max(200).nullable().optional(),
});

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

    return jsonSuccess({ drafts: visible }, { status: 200 });
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
