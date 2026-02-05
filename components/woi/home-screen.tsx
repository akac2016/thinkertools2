"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DemoUserField } from "@/components/shared/demo-user-field";
import { fetchTeamGames, formatDateTime, type WoiGameSummary } from "@/components/woi/client";
import { InlineMessage, WoiSection, WoiShell } from "@/components/woi/shell";

const TEAM_STORAGE_KEY = "woi-demo-team-id";

export function WoiHomeScreen() {
  const [teamId, setTeamId] = useState("");
  const [games, setGames] = useState<WoiGameSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGames = useCallback(async (incomingTeamId: string) => {
    const normalizedTeamId = incomingTeamId.trim();
    if (!normalizedTeamId) {
      setError("Enter a team ID to load WOI games.");
      setGames([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nextGames = await fetchTeamGames(normalizedTeamId);
      setGames(nextGames);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(TEAM_STORAGE_KEY, normalizedTeamId);
      }
    } catch (loadError) {
      setGames([]);
      setError(loadError instanceof Error ? loadError.message : "Failed to load games");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedTeamId = window.localStorage.getItem(TEAM_STORAGE_KEY)?.trim() ?? "";
    if (storedTeamId) {
      setTeamId(storedTeamId);
      void loadGames(storedTeamId);
    }
  }, [loadGames]);

  const newGameHref = useMemo(() => {
    const params = new URLSearchParams();
    if (teamId.trim()) {
      params.set("teamId", teamId.trim());
    }

    const suffix = params.toString() ? `?${params.toString()}` : "";
    return `/woi/games/new${suffix}`;
  }, [teamId]);

  return (
    <WoiShell
      title="Game Dashboard"
      subtitle="Load a team, review active games, and launch play or reflection."
    >
      <DemoUserField />

      <WoiSection title="Team Games">
        <form
          className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            void loadGames(teamId);
          }}
        >
          <label className="flex-1 text-sm text-slate-700">
            <span className="mb-1 block">Team ID</span>
            <input
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
              placeholder="UUID team id"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              {loading ? "Loading..." : "Load games"}
            </button>
            <Link
              href={newGameHref}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              New game
            </Link>
          </div>
        </form>

        {error ? <InlineMessage kind="error">{error}</InlineMessage> : null}

        {!error && !loading && games.length === 0 ? (
          <InlineMessage kind="info">
            No games found. Create one or verify the team ID.
          </InlineMessage>
        ) : null}

        {games.length > 0 ? (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {games.map((game) => (
              <li key={game.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-base font-semibold text-slate-900">{game.question}</h3>
                {game.description ? (
                  <p className="mt-1 line-clamp-3 text-sm text-slate-600">{game.description}</p>
                ) : null}

                <dl className="mt-3 grid grid-cols-1 gap-1 text-xs text-slate-600 sm:grid-cols-2">
                  <div>
                    <dt className="font-semibold text-slate-700">Status</dt>
                    <dd>{game.status}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-700">Current Player</dt>
                    <dd>{game.currentPlayer?.name ?? "Unknown"}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-700">Template</dt>
                    <dd>{game.template?.name ?? "Unknown template"}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-700">Updated</dt>
                    <dd>{formatDateTime(game.updatedAt)}</dd>
                  </div>
                </dl>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/woi/games/${game.id}/play`}
                    className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-700"
                  >
                    Play
                  </Link>
                  <Link
                    href={`/woi/games/${game.id}/reflect`}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    Reflect
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </WoiSection>
    </WoiShell>
  );
}
