"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DemoUserField } from "@/components/shared/demo-user-field";
import {
  fetchPublicGames,
  formatDateTime,
  type PublicGameSummary,
} from "@/components/woi/client";
import { InlineMessage, WoiSection, WoiShell } from "@/components/woi/shell";

export function LibraryScreen() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [games, setGames] = useState<PublicGameSummary[]>([]);

  const loadGames = async (incomingQuery: string) => {
    setLoading(true);
    setError(null);

    try {
      const nextGames = await fetchPublicGames(incomingQuery);
      setGames(nextGames);
    } catch (loadError) {
      setGames([]);
      setError(loadError instanceof Error ? loadError.message : "Failed to load public games");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadGames("");
  }, []);

  return (
    <WoiShell
      title="Public Library"
      subtitle="Search public WOI games and jump into play/reflect views."
    >
      <DemoUserField />

      <WoiSection title="Search public games">
        <form
          className="mb-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void loadGames(query);
          }}
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by question, category, or keyword"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        {error ? <InlineMessage kind="error">{error}</InlineMessage> : null}

        {!error && !loading && games.length === 0 ? (
          <InlineMessage kind="info">No public games found for this query.</InlineMessage>
        ) : null}

        {games.length > 0 ? (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {games.map((game) => (
              <li key={game.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-base font-semibold text-slate-900">{game.question}</h3>
                <p className="mt-1 line-clamp-3 text-sm text-slate-600">{game.description || "-"}</p>

                <dl className="mt-3 space-y-1 text-xs text-slate-600">
                  <div>
                    <dt className="font-semibold text-slate-700">Template</dt>
                    <dd>{game.templateName}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-700">Creator</dt>
                    <dd>{game.creator?.name ?? "Unknown"}</dd>
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
