"use client";

import { useState } from "react";
import Link from "next/link";

import { apiFetch, isApiRequestError } from "@/components/quipx/client";
import type { ContentDraft } from "@/lib/authoring/draft-types";

import { DraftSourceBadge } from "./draft-source-badge";

type Props = {
  drafts: ContentDraft[];
  trainings?: Training[];
  onResumeTraining?: (training: Training) => void;
};

type Training = {
  id: string;
  slug: string;
  title: string;
  description: string;
  publication_status: 'pending' | 'live' | 'archived';
  isEmpty?: boolean;
  isDraftOnly?: boolean;
  hasReleasableContent?: boolean;
};

type UnifiedDraftItem = 
  | { type: 'content'; draft: ContentDraft }
  | { type: 'training'; training: Training };

const STATUS_STYLES: Record<ContentDraft["status"], string> = {
  draft: "bg-slate-100 text-slate-600",
  valid: "bg-emerald-100 text-emerald-700",
  published: "bg-blue-100 text-blue-700",
  archived: "bg-rose-100 text-rose-600",
};

const STATUS_LABELS: Record<ContentDraft["status"], string> = {
  draft: "Draft",
  valid: "Valid",
  published: "Published",
  archived: "Archived",
};

const CONTENT_TYPE_LABELS: Record<ContentDraft["contentType"], string> = {
  activity: "Activity",
  mission: "Mission",
};

const EMPTY_TRAINING_RELEASE_MESSAGE =
  "Add and release at least one activity or mission before releasing this training.";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type FilterStatus = "all" | ContentDraft["status"];

export function DraftList({ drafts: initialDrafts, trainings = [], onResumeTraining }: Props) {
  const [drafts, setDrafts] = useState(initialDrafts);
  const [displayedTrainings, setDisplayedTrainings] = useState(trainings);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [releasing, setReleasing] = useState<string | null>(null);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [activeReleaseTooltip, setActiveReleaseTooltip] = useState<string | null>(null);

  // Create unified list of items
  const allItems: UnifiedDraftItem[] = [
    ...displayedTrainings.map(t => ({ type: 'training' as const, training: t })),
    ...drafts.map(d => ({ type: 'content' as const, draft: d })),
  ];

  const filteredItems = filter === "all" 
    ? allItems
    : allItems.filter(item => {
        if (item.type === 'training') return false; // trainings don't match content statuses
        return item.draft.status === filter;
      });

  async function handleDelete(e: React.MouseEvent, draftId: string) {
    e.preventDefault(); // don't navigate to the draft
    e.stopPropagation();
    if (deleting) return;

    setDeleting(draftId);
    try {
      await apiFetch(`/api/thinkertools-missions-create/drafts/${draftId}`, {
        method: "DELETE",
      });
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
    } catch {
      // silently ignore — draft stays in list
    } finally {
      setDeleting(null);
    }
  }

  async function handleRelease(e: React.MouseEvent, draftId: string) {
    e.preventDefault();
    e.stopPropagation();
    if (releasing) return;

    setReleasing(draftId);
    setReleaseError(null);
    try {
      await apiFetch(`/api/thinkertools-missions-create/drafts/${draftId}/release`, {
        method: "POST",
      });
      // Optionally refresh the draft list or show success message
      // For now, just clear the releasing state
    } catch (err) {
      setReleaseError(isApiRequestError(err) ? err.message : "Failed to release content");
    } finally {
      setReleasing(null);
    }
  }

  async function handleDeleteTraining(e: React.MouseEvent, trainingId: string) {
    e.preventDefault();
    e.stopPropagation();
    if (deleting) return;

    setDeleting(trainingId);
    try {
      await apiFetch(`/api/thinkertools-missions-create/trainings/${trainingId}`, {
        method: "DELETE",
      });
      setDisplayedTrainings(prev => prev.filter(t => t.id !== trainingId));
    } catch {
      // silently ignore — training stays in list
    } finally {
      setDeleting(null);
    }
  }

  if (allItems.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500">
        No drafts yet. Create one to get started.
      </p>
    );
  }

  const statusCounts = {
    all: allItems.length,
    draft: drafts.filter((d) => d.status === "draft").length,
    valid: drafts.filter((d) => d.status === "valid").length,
    published: drafts.filter((d) => d.status === "published").length,
    archived: drafts.filter((d) => d.status === "archived").length,
  };

  function handleTrainingRowKeyDown(e: React.KeyboardEvent, training: Training) {
    if (!onResumeTraining || (e.key !== "Enter" && e.key !== " ")) return;
    if ((e.target as HTMLElement | null)?.closest("button")) return;

    e.preventDefault();
    onResumeTraining(training);
  }

  return (
    <div className="space-y-3">
      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`px-3 py-2 text-sm font-medium transition-colors ${
            filter === "all"
              ? "border-b-2 border-slate-900 text-slate-900"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          All ({statusCounts.all})
        </button>
        <button
          type="button"
          onClick={() => setFilter("published")}
          className={`px-3 py-2 text-sm font-medium transition-colors ${
            filter === "published"
              ? "border-b-2 border-slate-900 text-slate-900"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Published ({statusCounts.published})
        </button>
        <button
          type="button"
          onClick={() => setFilter("valid")}
          className={`px-3 py-2 text-sm font-medium transition-colors ${
            filter === "valid"
              ? "border-b-2 border-slate-900 text-slate-900"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Ready ({statusCounts.valid})
        </button>
        <button
          type="button"
          onClick={() => setFilter("draft")}
          className={`px-3 py-2 text-sm font-medium transition-colors ${
            filter === "draft"
              ? "border-b-2 border-slate-900 text-slate-900"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          In Progress ({statusCounts.draft})
        </button>
      </div>

      {releaseError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {releaseError}
        </div>
      ) : null}

      {filteredItems.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500">
          No {filter === "all" ? "" : STATUS_LABELS[filter as ContentDraft["status"]]} drafts.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {filteredItems.map((item) => {
            if (item.type === 'training') {
              // Render training item
              const training = item.training;
              const badgeText = training.isEmpty
                ? "Training (Empty)"
                : training.isDraftOnly
                  ? "Training (Drafts only)"
                  : "Training (Draft)";
              const badgeStyle = training.isEmpty
                ? "bg-slate-100 text-slate-600"
                : "bg-amber-100 text-amber-700";
              
              return (
                <li
                  key={`training-${training.id}`}
                  className={`flex items-stretch bg-amber-50/50 ${onResumeTraining ? "cursor-pointer transition-colors hover:bg-amber-50" : ""}`}
                  onClick={() => onResumeTraining?.(training)}
                  onKeyDown={(e) => handleTrainingRowKeyDown(e, training)}
                  role={onResumeTraining ? "button" : undefined}
                  tabIndex={onResumeTraining ? 0 : undefined}
                  aria-label={onResumeTraining ? `Resume ${training.title}` : undefined}
                >
                  <div className="flex flex-1 items-start justify-between gap-4 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {training.title}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeStyle}`}>
                          {badgeText}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <p className="text-xs text-slate-400">
                        {training.publication_status === 'pending' ? 'Pending' : 
                         training.isEmpty ? 'Empty' : 'Draft'}
                      </p>

                      {/* Go Live button - disabled until pending trainings have live content */}
                      {training.publication_status === 'pending' && (
                        <span
                          className="relative inline-flex"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          onMouseEnter={() => {
                            if (!training.hasReleasableContent) setActiveReleaseTooltip(training.id);
                          }}
                          onMouseLeave={() => {
                            if (activeReleaseTooltip === training.id) setActiveReleaseTooltip(null);
                          }}
                        >
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (releasing || !training.hasReleasableContent) return;
                              setReleasing(training.id);
                              setReleaseError(null);
                              try {
                                await apiFetch(`/api/thinkertools-missions-create/trainings/${training.id}/release`, {
                                  method: "POST",
                                });
                                window.location.reload(); // Refresh to show updated status
                              } catch (err) {
                                setReleaseError(isApiRequestError(err) ? err.message : "Failed to release training");
                              } finally {
                                setReleasing(null);
                              }
                            }}
                            disabled={releasing === training.id || !training.hasReleasableContent}
                            aria-label={
                              training.hasReleasableContent
                                ? "Go live"
                                : "Go live unavailable: add and release at least one activity or mission first"
                            }
                            className={`rounded-md px-3 py-1 text-xs font-medium text-white disabled:cursor-not-allowed ${
                              training.hasReleasableContent
                                ? "bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40"
                                : "bg-slate-300 text-slate-500"
                            }`}
                          >
                            {releasing === training.id ? "..." : "Go Live"}
                          </button>
                          {!training.hasReleasableContent ? (
                            <>
                              <span
                                role="button"
                                tabIndex={0}
                                aria-disabled="true"
                                aria-describedby={`release-tooltip-${training.id}`}
                                aria-label="Go live unavailable"
                                className="absolute inset-0 z-10 cursor-not-allowed rounded-md"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setActiveReleaseTooltip(training.id);
                                }}
                                onFocus={() => setActiveReleaseTooltip(training.id)}
                                onBlur={() => setActiveReleaseTooltip(null)}
                                onKeyDown={(e) => {
                                  e.stopPropagation();
                                  if (e.key !== "Enter" && e.key !== " ") return;
                                  e.preventDefault();
                                  setActiveReleaseTooltip(training.id);
                                }}
                              />
                              {activeReleaseTooltip === training.id ? (
                                <span
                                  id={`release-tooltip-${training.id}`}
                                  role="tooltip"
                                  className="absolute bottom-full right-0 z-20 mb-2 w-56 rounded-md bg-slate-900 px-3 py-2 text-left text-xs font-medium leading-snug text-white shadow-lg"
                                >
                                  {EMPTY_TRAINING_RELEASE_MESSAGE}
                                </span>
                              ) : null}
                            </>
                          ) : null}
                        </span>
                      )}

                      {/* Trash icon */}
                      <button
                        type="button"
                        onClick={(e) => void handleDeleteTraining(e, training.id)}
                        disabled={deleting === training.id}
                        aria-label="Delete training"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-rose-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {deleting === training.id ? (
                          <span className="text-xs">…</span>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                            <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.711Z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>

                      <span className="text-xs text-slate-400">→</span>
                    </div>
                  </div>
                </li>
              );
            }

            // Render content draft item
            const draft = item.draft;
            return (
              <li key={draft.id} className="flex items-stretch">
                <Link
                  href={`/thinkertools-missions-create/drafts/${draft.id}`}
                  className="flex flex-1 items-start justify-between gap-4 px-5 py-4 transition-colors hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {draft.title || draft.trainingTitle || <span className="italic text-slate-400">Untitled</span>}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[draft.status]}`}>
                        {STATUS_LABELS[draft.status]}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {CONTENT_TYPE_LABELS[draft.contentType]}
                      </span>
                      {draft.contentType === "activity" && draft.activityGroupTitle ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-medium text-cyan-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" aria-hidden="true" />
                          {draft.activityGroupTitle}
                        </span>
                      ) : (
                        <DraftSourceBadge aiSource={draft.aiSource} />
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <p className="text-xs text-slate-400">{formatDate(draft.updatedAt)}</p>

                    {/* Go Live button - only show for published drafts */}
                    {draft.status === "published" && draft.publishedRefId ? (
                      <button
                        type="button"
                        onClick={(e) => void handleRelease(e, draft.id)}
                        disabled={releasing === draft.id}
                        aria-label="Go live"
                        className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
                      >
                        {releasing === draft.id ? "..." : "Go Live"}
                      </button>
                    ) : null}

                    {/* Trash icon */}
                    <button
                      type="button"
                      onClick={(e) => void handleDelete(e, draft.id)}
                      disabled={deleting === draft.id}
                      aria-label="Delete draft"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-rose-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {deleting === draft.id ? (
                        <span className="text-xs">…</span>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                          <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.711Z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>

                    <span className="text-xs text-slate-400">→</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
