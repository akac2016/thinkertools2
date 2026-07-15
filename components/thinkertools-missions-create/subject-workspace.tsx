import Link from "next/link";

import type { ContentDraft, DraftStatus } from "@/lib/authoring/draft-types";
import {
  ActivityGroupBrowser,
  type AuthoringActivityGroup,
  type UncategorizedActivityContent,
} from "./activity-group-browser";

type Training = {
  id: string;
  title: string;
};

type Props = {
  training: Training;
  groups: AuthoringActivityGroup[];
  uncategorized: UncategorizedActivityContent;
  drafts: ContentDraft[];
  loadingGroups: boolean;
  groupsError: string | null;
  loadingDrafts: boolean;
  draftsError: string | null;
  onAddQuestion: (group: AuthoringActivityGroup) => Promise<void>;
};

const STATUS_LABELS: Record<DraftStatus, string> = {
  draft: "In progress",
  valid: "Ready",
  published: "Published",
  archived: "Archived",
};

const STATUS_STYLES: Record<DraftStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  valid: "bg-emerald-100 text-emerald-700",
  published: "bg-blue-100 text-blue-700",
  archived: "bg-rose-100 text-rose-600",
};

export function SubjectWorkspace({
  training,
  groups,
  uncategorized,
  drafts,
  loadingGroups,
  groupsError,
  loadingDrafts,
  draftsError,
  onAddQuestion,
}: Props) {
  const subjectDrafts = drafts.filter((draft) => draft.primaryTrainingId === training.id);

  return (
    <section aria-labelledby="subject-workspace-heading" className="space-y-4">
      <div>
        <h2 id="subject-workspace-heading" className="text-sm font-semibold text-slate-700">
          Subject workspace
        </h2>
        <p className="mt-1 text-xs text-slate-500">{training.title}</p>
      </div>

      <ActivityGroupBrowser
        groups={groups}
        loading={loadingGroups}
        error={groupsError}
        uncategorized={uncategorized}
        headingLevel="h3"
        onAddQuestion={onAddQuestion}
      />

      <section aria-labelledby="drafts-heading">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h3 id="drafts-heading" className="text-sm font-semibold text-slate-600">
            Drafts
          </h3>
          {!loadingDrafts && !draftsError ? (
            <span className="text-xs text-slate-400">{subjectDrafts.length}</span>
          ) : null}
        </div>

        {loadingDrafts ? <p className="text-sm text-slate-400">Loading drafts…</p> : null}
        {draftsError ? <p className="text-sm text-rose-600">{draftsError}</p> : null}
        {!loadingDrafts && !draftsError && subjectDrafts.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">
            No drafts for this subject yet.
          </p>
        ) : null}
        {!loadingDrafts && !draftsError && subjectDrafts.length > 0 ? (
          <ul className="max-h-64 divide-y divide-slate-200 overflow-y-auto rounded-lg border border-slate-200 bg-white">
            {subjectDrafts.map((draft) => (
              <li key={draft.id}>
                <Link
                  href={`/thinkertools-missions-create/drafts/${draft.id}`}
                  className="group flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400"
                  aria-label={`Open ${draft.title || "untitled"} draft`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-medium text-slate-900">
                        {draft.title || <span className="italic text-slate-400">Untitled</span>}
                      </p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[draft.status]}`}>
                        {STATUS_LABELS[draft.status]}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {draft.contentType === "activity" ? "Activity" : "Mission"}
                      {draft.contentType === "activity"
                        ? draft.activityGroupTitle
                          ? ` · ${draft.activityGroupTitle}`
                          : " · Needs activity group"
                        : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-slate-500 group-hover:text-slate-800">
                    Open <span aria-hidden="true">→</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </section>
  );
}
