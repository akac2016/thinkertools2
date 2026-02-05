"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getDemoUserId } from "@/components/quipx/client";
import { DemoUserField } from "@/components/shared/demo-user-field";
import {
  fetchGameDetail,
  formatDateTime,
  submitTurn,
  type WoiGameDetail,
} from "@/components/woi/client";
import { InlineMessage, WoiSection, WoiShell } from "@/components/woi/shell";

export function WoiPlayScreen({ gameId }: { gameId: string }) {
  const [game, setGame] = useState<WoiGameDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [demoUserId, setDemoUserId] = useState<string>(() => getDemoUserId());

  const [content, setContent] = useState("");
  const [selectedLevelForSubmit, setSelectedLevelForSubmit] = useState("");
  const [moveId, setMoveId] = useState("");
  const [ruleId, setRuleId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [levelFilter, setLevelFilter] = useState<string>("all");

  const loadGame = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const detail = await fetchGameDetail(gameId);
      setGame(detail);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load game");
      setGame(null);
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    void loadGame();

    const intervalId = window.setInterval(() => {
      void loadGame();
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadGame]);

  const levelOptions = useMemo(() => {
    const options = new Map<number, string>();

    for (const level of game?.levels ?? []) {
      options.set(level.index, level.name || `Level ${level.index + 1}`);
    }

    for (const turn of game?.turns ?? []) {
      if (turn.levelIndex !== null && !options.has(turn.levelIndex)) {
        options.set(turn.levelIndex, `Level ${turn.levelIndex + 1}`);
      }
    }

    return Array.from(options.entries())
      .sort((left, right) => left[0] - right[0])
      .map(([value, label]) => ({ value, label }));
  }, [game?.levels, game?.turns]);

  const filteredTurns = useMemo(() => {
    if (!game) {
      return [];
    }

    if (levelFilter === "all") {
      return game.turns;
    }

    const expectedLevel = Number(levelFilter);
    return game.turns.filter((turn) => turn.levelIndex === expectedLevel);
  }, [game, levelFilter]);

  const isCurrentPlayer =
    Boolean(game?.currentPlayer?.id) && game?.currentPlayer?.id === demoUserId;

  const onSubmitTurn = async () => {
    if (!content.trim()) {
      setSubmitError("Turn text is required.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const parsedLevel = selectedLevelForSubmit
        ? Number(selectedLevelForSubmit)
        : null;

      await submitTurn(gameId, {
        content: content.trim(),
        levelIndex: Number.isFinite(parsedLevel) ? parsedLevel : null,
        moveId: moveId.trim(),
        ruleId: ruleId.trim(),
      });

      setContent("");
      setMoveId("");
      setRuleId("");
      await loadGame();
    } catch (turnError) {
      setSubmitError(turnError instanceof Error ? turnError.message : "Failed to submit turn");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <WoiShell
      title="Play Game"
      subtitle="Track turn order, filter by level, and submit the next move."
    >
      <DemoUserField
        onApplied={(userId) => {
          setDemoUserId(userId);
          void loadGame();
        }}
      />

      {error ? <InlineMessage kind="error">{error}</InlineMessage> : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <WoiSection
            title={game?.question ? `Game: ${game.question}` : `Game ${gameId}`}
            actions={
              <div className="flex gap-2">
                <Link
                  href="/woi"
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Games
                </Link>
                <Link
                  href={`/woi/games/${gameId}/reflect`}
                  className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-700"
                >
                  Reflect
                </Link>
              </div>
            }
          >
            {loading ? <InlineMessage kind="info">Loading game...</InlineMessage> : null}

            {!loading && game ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Current player
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {game.currentPlayer?.name ?? "Unassigned"}
                  </p>
                  <p className="text-xs text-slate-500">ID: {game.currentPlayer?.id ?? "n/a"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Status
                  </p>
                  <p className="mt-1 text-sm text-slate-800">{game.status}</p>
                  <p className="text-xs text-slate-500">
                    Visibility: {game.isPublic ? "Public" : "Private"}
                  </p>
                </div>
              </div>
            ) : null}

            {game?.description ? (
              <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                {game.description}
              </p>
            ) : null}
          </WoiSection>

          <WoiSection
            title="Turns"
            actions={
              <label className="text-xs text-slate-600">
                <span className="mr-2">Level filter</span>
                <select
                  value={levelFilter}
                  onChange={(event) => setLevelFilter(event.target.value)}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                >
                  <option value="all">All levels</option>
                  {levelOptions.map((option) => (
                    <option key={option.value} value={String(option.value)}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            }
          >
            {!loading && filteredTurns.length === 0 ? (
              <InlineMessage kind="info">No turns match this level filter yet.</InlineMessage>
            ) : null}

            {filteredTurns.length > 0 ? (
              <ul className="space-y-3">
                {filteredTurns.map((turn) => (
                  <li key={turn.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {turn.player?.name ?? "Unknown player"}
                      </p>
                      <p className="text-xs text-slate-500">{formatDateTime(turn.createdAt)}</p>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded bg-slate-200 px-2 py-1 text-slate-700">
                        Level: {turn.levelIndex === null ? "None" : turn.levelIndex + 1}
                      </span>
                      {turn.moveLabel ? (
                        <span className="rounded bg-sky-100 px-2 py-1 text-sky-800">
                          Move: {turn.moveLabel}
                        </span>
                      ) : null}
                      {turn.ruleLabel ? (
                        <span className="rounded bg-amber-100 px-2 py-1 text-amber-800">
                          Rule: {turn.ruleLabel}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{turn.content}</p>
                  </li>
                ))}
              </ul>
            ) : null}
          </WoiSection>
        </div>

        <WoiSection title="Submit Turn">
          {game && !isCurrentPlayer ? (
            <InlineMessage kind="info">
              You are not the current player ({game.currentPlayer?.name ?? "unknown"}). The API may reject your turn.
            </InlineMessage>
          ) : null}

          <label className="mt-3 block text-sm text-slate-700">
            <span className="mb-1 block">Turn text</span>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={6}
              placeholder="Write this turn's contribution"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            />
          </label>

          <label className="mt-3 block text-sm text-slate-700">
            <span className="mb-1 block">Level</span>
            <select
              value={selectedLevelForSubmit}
              onChange={(event) => setSelectedLevelForSubmit(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            >
              <option value="">No level</option>
              {levelOptions.map((option) => (
                <option key={option.value} value={String(option.value)}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-3 block text-sm text-slate-700">
            <span className="mb-1 block">Move ID (optional)</span>
            <input
              value={moveId}
              onChange={(event) => setMoveId(event.target.value)}
              placeholder="move UUID"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            />
          </label>

          <label className="mt-3 block text-sm text-slate-700">
            <span className="mb-1 block">Rule ID (optional)</span>
            <input
              value={ruleId}
              onChange={(event) => setRuleId(event.target.value)}
              placeholder="rule UUID"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            />
          </label>

          {submitError ? <InlineMessage kind="error">{submitError}</InlineMessage> : null}

          <button
            type="button"
            onClick={() => {
              if (submitting) {
                return;
              }
              void onSubmitTurn();
            }}
            className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={submitting}
          >
            {submitting ? "Submitting..." : "Submit turn"}
          </button>
        </WoiSection>
      </div>
    </WoiShell>
  );
}
