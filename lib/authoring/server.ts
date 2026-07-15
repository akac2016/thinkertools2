import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  ContentDraft,
  DraftContentType,
  DraftOrigin,
  DraftStatus,
  ValidationIssue,
} from "@/lib/authoring/draft-types";

// ---------------------------------------------------------------------------
// Row shape returned from the DB
// ---------------------------------------------------------------------------

type ContentDraftRow = {
  id: string;
  content_type: string;
  status: string;
  origin: string;
  primary_training_id: string;
  activity_group_id: string | null;
  title: string;
  slug: string | null;
  body: unknown;
  validation_issues: unknown;
  ai_source: string | null;
  ai_model: string | null;
  published_ref_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function rowToDraft(row: ContentDraftRow): ContentDraft {
  return {
    id: row.id,
    contentType: row.content_type as DraftContentType,
    status: row.status as DraftStatus,
    origin: row.origin as DraftOrigin,
    primaryTrainingId: row.primary_training_id,
    activityGroupId: row.activity_group_id ?? null,
    title: row.title,
    slug: row.slug,
    body: row.body,
    validationIssues: (row.validation_issues as ValidationIssue[]) ?? [],
    aiSource: row.ai_source as ContentDraft["aiSource"],
    aiModel: row.ai_model,
    publishedRefId: row.published_ref_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export type CreateDraftData = {
  contentType: DraftContentType;
  origin: DraftOrigin;
  primaryTrainingId: string;
  activityGroupId?: string | null;
  title?: string;
  slug?: string | null;
  body?: unknown;
  validationIssues?: ValidationIssue[];
  aiSource?: "openai" | "mock" | null;
  aiModel?: string | null;
  createdBy?: string | null;
};

export async function createDraft(data: CreateDraftData): Promise<ContentDraft> {
  const { data: rows, error } = await supabaseAdmin
    .from("content_drafts")
    .insert({
      content_type: data.contentType,
      origin: data.origin,
      primary_training_id: data.primaryTrainingId,
      activity_group_id: data.activityGroupId ?? null,
      title: data.title ?? "",
      slug: data.slug ?? null,
      body: data.body ?? {},
      validation_issues: data.validationIssues ?? [],
      ai_source: data.aiSource ?? null,
      ai_model: data.aiModel ?? null,
      created_by: data.createdBy ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`createDraft failed: ${error.message}`);
  return rowToDraft(rows as ContentDraftRow);
}

// ---------------------------------------------------------------------------
// Read by id
// ---------------------------------------------------------------------------

export async function getDraftById(id: string): Promise<ContentDraft | null> {
  const { data, error } = await supabaseAdmin
    .from("content_drafts")
    .select()
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getDraftById failed: ${error.message}`);
  if (!data) return null;
  return rowToDraft(data as ContentDraftRow);
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export type UpdateDraftData = Partial<{
  contentType: DraftContentType;
  status: DraftStatus;
  origin: DraftOrigin;
  primaryTrainingId: string;
  activityGroupId: string | null;
  title: string;
  slug: string | null;
  body: unknown;
  validationIssues: ValidationIssue[];
  aiSource: "openai" | "mock" | null;
  aiModel: string | null;
  publishedRefId: string | null;
}>;

export async function updateDraft(
  id: string,
  data: UpdateDraftData
): Promise<ContentDraft> {
  const patch: Record<string, unknown> = {};
  if (data.contentType !== undefined) patch.content_type = data.contentType;
  if (data.status !== undefined) patch.status = data.status;
  if (data.origin !== undefined) patch.origin = data.origin;
  if (data.primaryTrainingId !== undefined)
    patch.primary_training_id = data.primaryTrainingId;
  if (data.activityGroupId !== undefined)
    patch.activity_group_id = data.activityGroupId;
  if (data.title !== undefined) patch.title = data.title;
  if (data.slug !== undefined) patch.slug = data.slug;
  if (data.body !== undefined) patch.body = data.body;
  if (data.validationIssues !== undefined)
    patch.validation_issues = data.validationIssues;
  if (data.aiSource !== undefined) patch.ai_source = data.aiSource;
  if (data.aiModel !== undefined) patch.ai_model = data.aiModel;
  if (data.publishedRefId !== undefined)
    patch.published_ref_id = data.publishedRefId;

  const { data: rows, error } = await supabaseAdmin
    .from("content_drafts")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`updateDraft failed: ${error.message}`);
  return rowToDraft(rows as ContentDraftRow);
}

// ---------------------------------------------------------------------------
// List by creator
// ---------------------------------------------------------------------------

export async function listDraftsByCreator(
  createdBy: string
): Promise<ContentDraft[]> {
  const { data, error } = await supabaseAdmin
    .from("content_drafts")
    .select()
    .eq("created_by", createdBy)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`listDraftsByCreator failed: ${error.message}`);
  return (data as ContentDraftRow[]).map(rowToDraft);
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteDraft(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("content_drafts")
    .delete()
    .eq("id", id);

  if (error) throw new Error(`deleteDraft failed: ${error.message}`);
}
