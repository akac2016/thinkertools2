"use client";

import Link from "next/link";
import { useState } from "react";

import type { DraftStatus } from "@/lib/authoring/draft-types";

type DraftStatusCounts = Partial<Record<DraftStatus, number>>;

export type ActivityQuestionPreview = {
  id: string;
  title: string;
  questionText: string;
  difficultyLabel: string;
  publicationStatus: "pending" | "live";
};

export type ActivityDraftPreview = {
  id: string;
  title: string;
  questionText?: string;
  status: DraftStatus;
};

export type UncategorizedActivityContent = {
  questions: ActivityQuestionPreview[];
  drafts: ActivityDraftPreview[];
};

export type AuthoringActivityGroup = {
  id: string;
  title: string;
  questionCount?: number;
  questions?: ActivityQuestionPreview[];
  draftStatusCounts?: DraftStatusCounts;
  drafts?: ActivityDraftPreview[];
};

type Props = {
  groups: AuthoringActivityGroup[];
  loading: boolean;
  error: string | null;
  uncategorized?: UncategorizedActivityContent;
  headingLevel?: "h2" | "h3";
  onAddQuestion?: (group: AuthoringActivityGroup) => Promise<void>;
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

function describeGroupDrafts(counts: DraftStatusCounts | undefined): string | null {
  if (!counts) return null;

  const parts = (["draft", "valid", "published"] as const)
    .map((status) => {
      const count = counts[status] ?? 0;
      if (count === 0) return null;
      return `${count} ${STATUS_LABELS[status].toLowerCase()}`;
    })
    .filter((part): part is string => part !== null);

  return parts.length > 0 ? parts.join(" · ") : null;
}

function truncateQuestionText(questionText: string | null | undefined, maxLength = 100): string {
  const normalized = questionText?.trim().replace(/\s+/g, " ") ?? "";
  if (!normalized) return "Question not written yet";
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength).trimEnd()}…`
    : normalized;
}

export function ActivityGroupBrowser({
  groups,
  loading,
  error,
  uncategorized = { questions: [], drafts: [] },
  headingLevel = "h2",
  onAddQuestion,
}: Props) {
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [addingQuestionGroupId, setAddingQuestionGroupId] = useState<string | null>(null);
  const [addQuestionError, setAddQuestionError] = useState<string | null>(null);
  const Heading = headingLevel;
  const uncategorizedCount = uncategorized.questions.length + uncategorized.drafts.length;

  async function handleAddQuestion(group: AuthoringActivityGroup) {
    if (!onAddQuestion) return;

    setAddingQuestionGroupId(group.id);
    setAddQuestionError(null);
    try {
      await onAddQuestion(group);
    } catch (error) {
      setAddQuestionError(error instanceof Error ? error.message : "Failed to start a new question.");
      setAddingQuestionGroupId(null);
    }
  }

  return (
    <section id="activity-groups-workspace" aria-labelledby="activity-groups-heading" className="scroll-mt-6">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <Heading id="activity-groups-heading" className="text-sm font-semibold text-slate-600">
          Activity Groups
        </Heading>
        {!loading && !error ? (
          <span className="text-xs text-slate-400">{groups.length}</span>
        ) : null}
      </div>

      {!loading && !error && groups.length > 0 ? (
        <p className="mb-2 text-xs text-slate-500">
          Open a group to preview its questions. Scroll within the list to see every group.
        </p>
      ) : null}

      {loading ? <p className="text-sm text-slate-400">Loading activity groups…</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {!loading && !error && groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">
          No activity groups for this subject yet.
        </p>
      ) : null}
      {!loading && !error && groups.length > 0 ? (
        <ul className="max-h-[36rem] divide-y divide-slate-200 overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-white">
          {groups.map((group) => {
            const questionCount = group.questionCount ?? 0;
            const draftSummary = describeGroupDrafts(group.draftStatusCounts);
            const isExpanded = expandedGroupId === group.id;
            const questions = group.questions ?? [];
            const drafts = group.drafts ?? [];

            return (
              <li key={group.id}>
                <button
                  type="button"
                  onClick={() => setExpandedGroupId(isExpanded ? null : group.id)}
                  aria-expanded={isExpanded}
                  aria-controls={`activity-group-questions-${group.id}`}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-900">{group.title}</span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {questionCount} {questionCount === 1 ? "question" : "questions"}
                      {draftSummary ? ` · ${draftSummary}` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs font-medium text-slate-500">
                    {isExpanded ? "Hide questions" : "View questions"}
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                      className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    >
                      <path fillRule="evenodd" d="M5.22 7.22a.75.75 0 011.06 0L10 10.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 8.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                    </svg>
                  </span>
                </button>

                {isExpanded ? (
                  <div
                    id={`activity-group-questions-${group.id}`}
                    className="border-t border-slate-100 bg-slate-50/70 px-4 py-3"
                  >
                    {onAddQuestion ? (
                      <div className="mb-4 flex justify-start">
                        <button
                          type="button"
                          onClick={() => void handleAddQuestion(group)}
                          disabled={addingQuestionGroupId !== null}
                          className="shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:cursor-wait disabled:opacity-60"
                        >
                          {addingQuestionGroupId === group.id ? "Opening…" : "Add question here"}
                        </button>
                      </div>
                    ) : null}
                    {addQuestionError && addingQuestionGroupId === null ? (
                      <p className="mb-3 text-xs text-rose-600">{addQuestionError}</p>
                    ) : null}
                    <section aria-label="Questions in this group">
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Questions
                      </h4>
                      {questions.length === 0 ? (
                        <p className="text-sm text-slate-500">No published or pending questions in this group yet.</p>
                      ) : (
                        <ol className="space-y-2">
                          {questions.map((question, index) => (
                            <li key={question.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-xs font-medium text-slate-500">
                                  {index + 1}. {question.title}
                                </p>
                                <div className="flex shrink-0 items-center gap-1.5">
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium capitalize text-slate-600">
                                    {question.difficultyLabel}
                                  </span>
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${question.publicationStatus === "live" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                    {question.publicationStatus === "live" ? "Live" : "Pending"}
                                  </span>
                                </div>
                              </div>
                              <p className="mt-1 text-sm leading-relaxed text-slate-800">{question.questionText}</p>
                            </li>
                          ))}
                        </ol>
                      )}
                    </section>

                    {drafts.length > 0 ? (
                      <section className="mt-4" aria-label="Your drafts in this group">
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Your drafts in this group
                        </h4>
                        <ul className="space-y-2">
                          {drafts.map((draft) => (
                            <li key={draft.id}>
                              <Link
                                href={`/thinkertools-missions-create/drafts/${draft.id}`}
                                className="group flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                                aria-label={`Open draft: ${draft.questionText || "Question not written yet"}`}
                              >
                                <span
                                  className={`min-w-0 text-sm font-medium ${draft.questionText ? "text-slate-800" : "italic text-slate-400"}`}
                                  title={draft.questionText || undefined}
                                >
                                  {truncateQuestionText(draft.questionText)}
                                </span>
                                <span className="flex shrink-0 items-center gap-2">
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[draft.status]}`}>
                                    {STATUS_LABELS[draft.status]}
                                  </span>
                                  <span className="text-xs font-medium text-slate-500 group-hover:text-slate-800">
                                    Open <span aria-hidden="true">→</span>
                                  </span>
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {!loading && !error ? (
        <section aria-labelledby="uncategorized-questions-heading" className="mt-5">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h3 id="uncategorized-questions-heading" className="text-sm font-semibold text-slate-600">
              Uncategorized questions
            </h3>
            <span className="text-xs text-slate-400">{uncategorizedCount}</span>
          </div>
          <p className="mb-2 text-xs text-slate-500">
            Questions that still need an activity group.
          </p>

          {uncategorizedCount === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">
              All questions in this subject are assigned to an activity group.
            </p>
          ) : (
            <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-3">
              {uncategorized.questions.length > 0 ? (
                <section aria-label="Uncategorized published or pending questions">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Published or pending questions
                  </h4>
                  <ol className="space-y-2">
                    {uncategorized.questions.map((question, index) => (
                      <li key={question.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-xs font-medium text-slate-500">
                            {index + 1}. {question.title}
                          </p>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium capitalize text-slate-600">
                              {question.difficultyLabel}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${question.publicationStatus === "live" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                              {question.publicationStatus === "live" ? "Live" : "Pending"}
                            </span>
                          </div>
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-slate-800">{question.questionText}</p>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}

              {uncategorized.drafts.length > 0 ? (
                <section aria-label="Your uncategorized draft questions">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Your draft questions
                  </h4>
                  <ul className="space-y-2">
                    {uncategorized.drafts.map((draft) => (
                      <li key={draft.id}>
                        <Link
                          href={`/thinkertools-missions-create/drafts/${draft.id}`}
                          className="group flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 transition-colors hover:border-slate-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                          aria-label={`Open uncategorized draft: ${draft.questionText || "Question not written yet"}`}
                        >
                          <span
                            className={`min-w-0 text-sm font-medium ${draft.questionText ? "text-slate-800" : "italic text-slate-400"}`}
                            title={draft.questionText || undefined}
                          >
                            {truncateQuestionText(draft.questionText)}
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[draft.status]}`}>
                              {STATUS_LABELS[draft.status]}
                            </span>
                            <span className="text-xs font-medium text-slate-500 group-hover:text-slate-800">
                              Open <span aria-hidden="true">→</span>
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          )}
        </section>
      ) : null}
    </section>
  );
}
