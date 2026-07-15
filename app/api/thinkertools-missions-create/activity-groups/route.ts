import "server-only";

import { z } from "zod";

import { parseBody, unexpectedError } from "@/lib/api/route-utils";
import { requireActorIdFromRequest } from "@/lib/auth/actor";
import { jsonSuccess } from "@/lib/http";
import { extractQuestionText, type TrainingActivityRoundContent } from "@/lib/quests";
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

type DraftStatus = "draft" | "valid" | "published" | "archived";
type GroupDraftRow = {
  id: string;
  title: string;
  body: unknown;
  activity_group_id: string | null;
  status: DraftStatus;
};
type ActivityQuestionRow = {
  id: string;
  title: string;
  activity_group_id: string | null;
  difficulty_label: string;
  publication_status: "pending" | "live";
  round_content: TrainingActivityRoundContent;
};

function normalizeTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function extractDraftQuestionText(body: unknown): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "";
  const questionText = (body as Record<string, unknown>).question_text;
  return typeof questionText === "string" ? questionText.trim() : "";
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

    const { data, error } = await query.returns<ActivityGroupRow[]>();
    if (error) throw new Error(error.message);

    const groups = data ?? [];
    const groupIds = groups.map((group) => group.id);

    const [questionsResult, draftsResult, uncategorizedQuestionsResult, uncategorizedDraftsResult] = await Promise.all([
      groupIds.length > 0
        ? supabaseAdmin
            .from("training_activities")
            .select("id, title, activity_group_id, difficulty_label, publication_status, round_content")
            .in("activity_group_id", groupIds)
            .neq("publication_status", "archived")
            .order("title", { ascending: true })
            .returns<ActivityQuestionRow[]>()
        : Promise.resolve({ data: [], error: null }),
      groupIds.length > 0
        ? supabaseAdmin
            .from("content_drafts")
            .select("id, title, body, activity_group_id, status")
            .eq("created_by", actor.actorId)
            .eq("content_type", "activity")
            .in("activity_group_id", groupIds)
            .neq("status", "archived")
            .order("updated_at", { ascending: false })
            .returns<GroupDraftRow[]>()
        : Promise.resolve({ data: [], error: null }),
      trainingId
        ? supabaseAdmin
            .from("training_activities")
            .select("id, title, activity_group_id, difficulty_label, publication_status, round_content")
            .eq("primary_training_id", trainingId)
            .is("activity_group_id", null)
            .neq("publication_status", "archived")
            .order("title", { ascending: true })
            .returns<ActivityQuestionRow[]>()
        : Promise.resolve({ data: [], error: null }),
      trainingId
        ? supabaseAdmin
            .from("content_drafts")
            .select("id, title, body, activity_group_id, status")
            .eq("created_by", actor.actorId)
            .eq("content_type", "activity")
            .eq("primary_training_id", trainingId)
            .is("activity_group_id", null)
            .neq("status", "archived")
            .order("updated_at", { ascending: false })
            .returns<GroupDraftRow[]>()
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (questionsResult.error) throw new Error(questionsResult.error.message);
    if (draftsResult.error) throw new Error(draftsResult.error.message);
    if (uncategorizedQuestionsResult.error) {
      throw new Error(uncategorizedQuestionsResult.error.message);
    }
    if (uncategorizedDraftsResult.error) {
      throw new Error(uncategorizedDraftsResult.error.message);
    }

    const questionCountByGroup = new Map<string, number>();
    const questionsByGroup = new Map<string, Array<{
      id: string;
      title: string;
      questionText: string;
      difficultyLabel: string;
      publicationStatus: "pending" | "live";
    }>>();
    for (const question of questionsResult.data ?? []) {
      if (!question.activity_group_id) continue;
      questionCountByGroup.set(
        question.activity_group_id,
        (questionCountByGroup.get(question.activity_group_id) ?? 0) + 1,
      );
      const questions = questionsByGroup.get(question.activity_group_id) ?? [];
      questions.push({
        id: question.id,
        title: question.title,
        questionText: extractQuestionText(question.round_content),
        difficultyLabel: question.difficulty_label,
        publicationStatus: question.publication_status,
      });
      questionsByGroup.set(question.activity_group_id, questions);
    }

    const draftStatusCountsByGroup = new Map<string, Partial<Record<DraftStatus, number>>>();
    const draftsByGroup = new Map<string, Array<{
      id: string;
      title: string;
      questionText: string;
      status: DraftStatus;
    }>>();
    for (const draft of draftsResult.data ?? []) {
      if (!draft.activity_group_id) continue;
      const counts = draftStatusCountsByGroup.get(draft.activity_group_id) ?? {};
      counts[draft.status] = (counts[draft.status] ?? 0) + 1;
      draftStatusCountsByGroup.set(draft.activity_group_id, counts);

      const drafts = draftsByGroup.get(draft.activity_group_id) ?? [];
      drafts.push({
        id: draft.id,
        title: draft.title,
        questionText: extractDraftQuestionText(draft.body),
        status: draft.status,
      });
      draftsByGroup.set(draft.activity_group_id, drafts);
    }

    return jsonSuccess({
      groups: groups.map((group) => ({
        ...group,
        questionCount: questionCountByGroup.get(group.id) ?? 0,
        questions: questionsByGroup.get(group.id) ?? [],
        draftStatusCounts: draftStatusCountsByGroup.get(group.id) ?? {},
        drafts: draftsByGroup.get(group.id) ?? [],
      })),
      uncategorized: {
        questions: (uncategorizedQuestionsResult.data ?? []).map((question) => ({
          id: question.id,
          title: question.title,
          questionText: extractQuestionText(question.round_content),
          difficultyLabel: question.difficulty_label,
          publicationStatus: question.publication_status,
        })),
        drafts: (uncategorizedDraftsResult.data ?? []).map((draft) => ({
          id: draft.id,
          title: draft.title,
          questionText: extractDraftQuestionText(draft.body),
          status: draft.status,
        })),
      },
    });
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
