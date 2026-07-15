import type { ContentDraft } from "@/lib/authoring/draft-types";
import type { UpdateDraftData } from "@/lib/authoring/server";
import { validateDraft } from "@/lib/authoring/validation";

export type DraftUpdateInput = {
  title?: string;
  body?: Record<string, unknown>;
  slug?: string | null;
  activityGroupId?: string | null;
};

/**
 * Builds the persistence patch for an educator draft edit.
 *
 * Activity-group placement is organizational metadata, so an assignment-only
 * update deliberately preserves authorship, publication status, and content.
 */
export function buildDraftUpdatePatch(
  draft: ContentDraft,
  input: DraftUpdateInput,
): UpdateDraftData {
  const { title, body, slug, activityGroupId } = input;
  const hasAuthoredContentEdit =
    title !== undefined || body !== undefined || slug !== undefined;
  const patch: UpdateDraftData = {};

  if (hasAuthoredContentEdit) {
    patch.origin = draft.origin === "ai" ? "co_authored" : draft.origin;
    patch.status = draft.status === "published" ? "draft" : draft.status;
  }
  if (title !== undefined) patch.title = title;
  if (body !== undefined) patch.body = body;
  if (slug !== undefined) patch.slug = slug;
  if (activityGroupId !== undefined) patch.activityGroupId = activityGroupId;

  if (hasAuthoredContentEdit) {
    const effectiveBody = body !== undefined ? body : draft.body;
    const validationIssues = validateDraft(draft.contentType, effectiveBody);
    if (draft.status !== "published") {
      patch.status = validationIssues.length === 0 ? "valid" : "draft";
    }
    patch.validationIssues = validationIssues;
  }

  return patch;
}
