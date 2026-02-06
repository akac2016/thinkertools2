"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchComments,
  fetchGameDetail,
  formatDateTime,
  postComment,
  type ContextComment,
  type WoiGameDetail,
} from "@/components/woi/client";
import { InlineMessage, WoiSection, WoiShell } from "@/components/woi/shell";

export function WoiReflectScreen({ gameId }: { gameId: string }) {
  const [game, setGame] = useState<WoiGameDetail | null>(null);
  const [comments, setComments] = useState<ContextComment[]>([]);

  const [loadingGame, setLoadingGame] = useState(true);
  const [gameError, setGameError] = useState<string | null>(null);

  const [loadingComments, setLoadingComments] = useState(true);
  const [commentError, setCommentError] = useState<string | null>(null);

  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const loadGame = useCallback(async () => {
    setLoadingGame(true);
    setGameError(null);

    try {
      const nextGame = await fetchGameDetail(gameId);
      setGame(nextGame);
    } catch (loadError) {
      setGame(null);
      setGameError(loadError instanceof Error ? loadError.message : "Failed to load game");
    } finally {
      setLoadingGame(false);
    }
  }, [gameId]);

  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    setCommentError(null);

    try {
      const nextComments = await fetchComments(gameId);
      setComments(nextComments);
    } catch (loadError) {
      setCommentError(
        loadError instanceof Error ? loadError.message : "Failed to load comments",
      );
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  }, [gameId]);

  useEffect(() => {
    void loadGame();
    void loadComments();
  }, [loadComments, loadGame]);

  const turnsByLevel = useMemo(() => {
    const counts = new Map<string, number>();
    for (const turn of game?.turns ?? []) {
      const key = turn.levelIndex === null ? "No level" : `Level ${turn.levelIndex + 1}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return Array.from(counts.entries());
  }, [game?.turns]);

  const submitComment = async () => {
    const trimmed = newComment.trim();
    if (!trimmed) {
      return;
    }

    setPostingComment(true);

    try {
      const created = await postComment(gameId, trimmed);
      setComments((previous) => [created, ...previous]);
      setNewComment("");
      setCommentError(null);
    } catch (createError) {
      setCommentError(
        createError instanceof Error ? createError.message : "Failed to post comment",
      );
    } finally {
      setPostingComment(false);
    }
  };

  return (
    <WoiShell
      title="Reflect"
      subtitle="Review turns by level and capture final comments for this game."
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <WoiSection
            title={game?.question ? `Reflection: ${game.question}` : `Game ${gameId}`}
            actions={
              <div className="flex gap-2">
                <Link
                  href={`/woi/games/${gameId}`}
                  className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-700"
                >
                  Back to play
                </Link>
                <Link
                  href="/library"
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Public library
                </Link>
              </div>
            }
          >
            {loadingGame ? <InlineMessage kind="info">Loading reflection data...</InlineMessage> : null}
            {gameError ? <InlineMessage kind="error">{gameError}</InlineMessage> : null}

            {!loadingGame && !gameError && game ? (
              <>
                <p className="text-sm text-slate-700">{game.description || "No description provided."}</p>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Total turns
                    </p>
                    <p className="mt-1 text-xl font-semibold text-slate-900">{game.turns.length}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Current player
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {game.currentPlayer?.name ?? "Unknown"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Visibility
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {game.isPublic ? "Public" : "Private"}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-slate-900">Turn count by level</h3>
                  {turnsByLevel.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-600">No turns yet.</p>
                  ) : (
                    <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {turnsByLevel.map(([label, count]) => (
                        <li
                          key={label}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                        >
                          <span className="font-semibold text-slate-900">{label}</span>: {count}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            ) : null}
          </WoiSection>
        </div>

        <WoiSection title="Comments">
          {loadingComments ? <InlineMessage kind="info">Loading comments...</InlineMessage> : null}
          {commentError ? <InlineMessage kind="error">{commentError}</InlineMessage> : null}

          <label className="mt-3 block text-sm text-slate-700">
            <span className="mb-1 block">Add comment</span>
            <textarea
              value={newComment}
              onChange={(event) => setNewComment(event.target.value)}
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
              placeholder="Capture reflection insight"
            />
          </label>

          <button
            type="button"
            onClick={() => {
              if (postingComment) {
                return;
              }
              void submitComment();
            }}
            className="mt-2 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={postingComment}
          >
            {postingComment ? "Posting..." : "Post comment"}
          </button>

          {comments.length === 0 && !loadingComments ? (
            <p className="mt-3 text-sm text-slate-600">No comments yet.</p>
          ) : null}

          {comments.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {comments.map((comment) => (
                <li key={comment.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm text-slate-800">{comment.body}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {comment.author?.name ?? "Unknown"} • {formatDateTime(comment.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </WoiSection>
      </div>
    </WoiShell>
  );
}
