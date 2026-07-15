export type DraftStatus = "draft" | "valid" | "published" | "archived";
export type DraftOrigin = "manual" | "ai" | "co_authored";
export type DraftContentType = "activity" | "mission";

export type ValidationIssue = { path: string; code: string; message: string };

export type ContentDraft = {
  id: string;
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
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  trainingTitle?: string | null;
  activityGroupTitle?: string | null;
  publishedActivityStatus?: "pending" | "live" | null;
};
