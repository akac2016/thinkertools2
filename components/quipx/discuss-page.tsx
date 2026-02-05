"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { apiFetch, parseArray, parseObject, parseString } from "@/components/quipx/client";
import { DataPanel, JsonView, PhaseNav, QuipxShell, StatusCard } from "@/components/quipx/ui";

type CommentItem = {
  id: string;
  author: string;
  body: string;
  at: string;
  raw: unknown;
};

function parseComment(value: unknown, index: number): CommentItem {
  const object = parseObject(value) ?? {};
  return {
    id: parseString(object.id ?? object.commentId, `comment-${index + 1}`),
    author: parseString(object.author ?? object.userId, "demo-user"),
    body: parseString(object.body ?? object.content ?? object.text, ""),
    at: parseString(object.createdAt ?? object.timestamp, "just now"),
    raw: value,
  };
}

export function QuipxDiscussPage({ sessionId }: { sessionId: string }) {
  const [discuss, setDiscuss] = useState<unknown>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loadingDiscuss, setLoadingDiscuss] = useState(true);
  const [loadingComments, setLoadingComments] = useState(true);
  const [discussError, setDiscussError] = useState<string | null>(null);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("I want sharper examples for enterprise users.");
  const [posting, setPosting] = useState(false);

  const nextHref = useMemo(() => `/quipx/sessions/${sessionId}/reflect`, [sessionId]);

  useEffect(() => {
    let active = true;

    const loadDiscuss = async () => {
      try {
        const data = await apiFetch<unknown>(`/api/quipx/sessions/${sessionId}/discuss`);
        if (!active) {
          return;
        }

        setDiscuss(data);
        setDiscussError(null);
      } catch (err) {
        if (!active) {
          return;
        }

        const message = err instanceof Error ? err.message : "Unable to load discuss state.";
        setDiscussError(message);
      } finally {
        if (active) {
          setLoadingDiscuss(false);
        }
      }
    };

    const loadComments = async () => {
      try {
        const data = await apiFetch<unknown>(`/api/comments?sessionId=${encodeURIComponent(sessionId)}`);
        if (!active) {
          return;
        }

        const list = parseArray(parseObject(data)?.comments ?? data).map(parseComment);
        setComments(list);
        setCommentsError(null);
      } catch (err) {
        if (!active) {
          return;
        }

        const message = err instanceof Error ? err.message : "Unable to load comments.";
        setCommentsError(message);
      } finally {
        if (active) {
          setLoadingComments(false);
        }
      }
    };

    void loadDiscuss();
    void loadComments();

    const discussPoll = window.setInterval(() => {
      void loadDiscuss();
    }, 4000);

    const commentsPoll = window.setInterval(() => {
      void loadComments();
    }, 3000);

    return () => {
      active = false;
      window.clearInterval(discussPoll);
      window.clearInterval(commentsPoll);
    };
  }, [sessionId]);

  const submitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newComment.trim()) {
      return;
    }

    setPosting(true);

    try {
      await apiFetch<unknown>("/api/comments", {
        method: "POST",
        body: JSON.stringify({ sessionId, body: newComment.trim() }),
      });
      setNewComment("");

      const reloaded = await apiFetch<unknown>(`/api/comments?sessionId=${encodeURIComponent(sessionId)}`);
      const list = parseArray(parseObject(reloaded)?.comments ?? reloaded).map(parseComment);
      setComments(list);
      setCommentsError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to post comment.";
      setCommentsError(message);
    } finally {
      setPosting(false);
    }
  };

  return (
    <QuipxShell
      title="Discuss"
      subtitle="Live polling every few seconds keeps the thread and comments fresh for demo behavior."
    >
      <PhaseNav sessionId={sessionId} />

      <div className="grid gap-4 lg:grid-cols-2">
        <DataPanel
          title="Discussion State"
          right={
            <Link
              href={nextHref}
              className="rounded-md bg-slate-900 px-3 py-1 text-sm font-medium text-white hover:bg-slate-700"
            >
              Continue to Reflect
            </Link>
          }
        >
          {discuss ? (
            <JsonView value={discuss} />
          ) : (
            <StatusCard
              loading={loadingDiscuss}
              error={discussError}
              emptyLabel="No discuss payload returned yet."
            />
          )}
        </DataPanel>

        <DataPanel title="Comments (Polling)">
          <form className="mb-3 grid gap-2" onSubmit={submitComment}>
            <textarea
              rows={3}
              value={newComment}
              onChange={(event) => setNewComment(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              placeholder="Add a comment"
            />
            <button
              type="submit"
              disabled={posting}
              className="justify-self-start rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              {posting ? "Posting..." : "Post comment"}
            </button>
          </form>

          {comments.length > 0 ? (
            <ul className="space-y-2">
              {comments.map((comment) => (
                <li key={comment.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-sm text-slate-800">{comment.body || "(empty)"}</p>
                  <p className="mt-1 text-xs text-slate-500">{comment.author} • {comment.at}</p>
                </li>
              ))}
            </ul>
          ) : (
            <StatusCard
              loading={loadingComments}
              error={commentsError}
              emptyLabel="No comments yet for this session."
            />
          )}
        </DataPanel>
      </div>
    </QuipxShell>
  );
}
