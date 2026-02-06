"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
  fetchPublicGames,
  formatDateTime,
  type PublicGameSummary,
} from "@/components/woi/client";
import { InlineMessage, WoiSection, WoiShell } from "@/components/woi/shell";

export function LibraryScreen() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [games, setGames] = useState<PublicGameSummary[]>([]);

  const loadGames = async (incomingQuery: string) => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchPublicGames(incomingQuery);
      setGames(result.games);
      setActiveQuery(result.query);
    } catch (loadError) {
      setGames([]);
      setActiveQuery(incomingQuery.trim());
      setError(loadError instanceof Error ? loadError.message : "Failed to load public games");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const queryFromUrl = searchParams.get("q")?.trim() ?? "";
    setQuery(queryFromUrl);
    void loadGames(queryFromUrl);
  }, [searchParams]);

  return (
    <WoiShell
      title="Public Library"
      subtitle="Search public WOI games and open the unified game workspace."
    >
      <WoiSection title="Search public games">
        <form
          className="mb-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            const params = new URLSearchParams(searchParams.toString());
            if (query.trim()) {
              params.set("q", query.trim());
            } else {
              params.delete("q");
            }
            const suffix = params.toString();
            router.replace(suffix ? `${pathname}?${suffix}` : pathname);
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

        {activeQuery ? (
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
              Query: {activeQuery}
            </span>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setActiveQuery("");
                router.replace(pathname);
                void loadGames("");
              }}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Clear
            </button>
          </div>
        ) : null}

        {error ? <InlineMessage kind="error">{error}</InlineMessage> : null}

        {!error && !loading && games.length === 0 ? (
          <InlineMessage kind="info">
            {activeQuery
              ? `No public games found for "${activeQuery}".`
              : "No public games found."}
          </InlineMessage>
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
                    href={`/woi/games/${game.id}`}
                    className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-700"
                  >
                    Play
                  </Link>
                  <Link
                    href={`/woi/games/${game.id}?tab=reflect`}
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
