"use client";

import { useState } from "react";
import Link from "next/link";

import { apiFetch } from "@/components/quipx/client";
import type { ContentDraft } from "@/lib/authoring/draft-types";

import { DraftSourceBadge } from "./draft-source-badge";

type Props = {
  drafts: ContentDraft[];
};

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function DraftList({ drafts: initialDrafts }: Props) {
  const [drafts, setDrafts] = useState(initialDrafts);
  const [deleting, setDeleting] = useState<string | null>(null);

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

  if (drafts.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500">
        No drafts yet. Create one to get started.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
      {drafts.map((draft) => (
        <li key={draft.id} className="flex items-stretch">
          <Link
            href={`/thinkertools-missions-create/drafts/${draft.id}`}
            className="flex flex-1 items-start justify-between gap-4 px-5 py-4 transition-colors hover:bg-slate-50"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">
                {draft.title || <span className="italic text-slate-400">Untitled</span>}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[draft.status]}`}>
                  {STATUS_LABELS[draft.status]}
                </span>
                <span className="text-[11px] text-slate-500">
                  {CONTENT_TYPE_LABELS[draft.contentType]}
                </span>
                <DraftSourceBadge aiSource={draft.aiSource} />
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <p className="text-xs text-slate-400">{formatDate(draft.updatedAt)}</p>

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
      ))}
    </ul>
  );
}
