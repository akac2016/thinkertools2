"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  claimLobbySeat,
  fetchLobbyGames,
  formatDateTime,
  getViewerJoinErrorMessage,
  joinGameAsViewer,
  type WoiLobbyGameSummary,
} from "@/components/woi/client";
import { InlineMessage } from "@/components/woi/shell";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseJoinLinkInput(input: string): { gameId: string; token: string } | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsedUrl = new URL(trimmed);
      const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
      let gameId = "";

      for (let index = 0; index < pathSegments.length; index += 1) {
        const segment = pathSegments[index] ?? "";
        if (UUID_PATTERN.test(segment)) {
          gameId = segment;
          break;
        }
      }

      const token =
        parsedUrl.searchParams.get("token")?.trim()
        || parsedUrl.searchParams.get("joinToken")?.trim()
        || "";

      if (UUID_PATTERN.test(gameId) && token) {
        return { gameId, token };
      }
    } catch {
      return null;
    }
  }

  const colonParts = trimmed.split(":");
  if (colonParts.length === 2) {
    const gameId = colonParts[0]?.trim() ?? "";
    const token = colonParts[1]?.trim() ?? "";
    if (UUID_PATTERN.test(gameId) && token) {
      return { gameId, token };
    }
  }

  const spaceParts = trimmed.split(/\s+/);
  if (spaceParts.length === 2) {
    const gameId = spaceParts[0]?.trim() ?? "";
    const token = spaceParts[1]?.trim() ?? "";
    if (UUID_PATTERN.test(gameId) && token) {
      return { gameId, token };
    }
  }

  return null;
}

type WoiLobbyScreenProps = {
  onLobbyCountChange?: (count: number) => void;
};

export function WoiLobbyScreen({ onLobbyCountChange }: WoiLobbyScreenProps) {
  const router = useRouter();

  const [games, setGames] = useState<WoiLobbyGameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joinLinkInput, setJoinLinkInput] = useState("");
  const [joinLinkError, setJoinLinkError] = useState<string | null>(null);
  const [joiningPlayerGameId, setJoiningPlayerGameId] = useState<string | null>(null);
  const [joiningViewerGameId, setJoiningViewerGameId] = useState<string | null>(null);
  const [gameActionErrors, setGameActionErrors] = useState<Record<string, string>>({});

  const loadLobbyGames = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setLoading(true);
      }
      setError(null);

      try {
        const nextGames = await fetchLobbyGames();
        setGames(nextGames);
        onLobbyCountChange?.(nextGames.length);
      } catch (loadError) {
        setGames([]);
        onLobbyCountChange?.(0);
        setError(loadError instanceof Error ? loadError.message : "Failed to load lobby games");
      } finally {
        if (!options?.silent) {
          setLoading(false);
        }
      }
    },
    [onLobbyCountChange],
  );

  useEffect(() => {
    void loadLobbyGames();

    const intervalId = window.setInterval(() => {
      void loadLobbyGames({ silent: true });
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [loadLobbyGames]);

  const setGameActionError = useCallback((gameId: string, value: string) => {
    setGameActionErrors((previous) => ({
      ...previous,
      [gameId]: value,
    }));
  }, []);

  const handleJoinAsPlayer = useCallback(
    async (game: WoiLobbyGameSummary) => {
      setGameActionError(game.id, "");
      setJoiningPlayerGameId(game.id);

      try {
        await claimLobbySeat(game.id);
        router.push(`/woi/games/${game.id}`);
      } catch (joinError) {
        setGameActionError(
          game.id,
          joinError instanceof Error ? joinError.message : "Failed to join as player",
        );
      } finally {
        setJoiningPlayerGameId((current) => (current === game.id ? null : current));
        void loadLobbyGames({ silent: true });
      }
    },
    [loadLobbyGames, router, setGameActionError],
  );

  const handleJoinAsViewer = useCallback(
    async (game: WoiLobbyGameSummary) => {
      setGameActionError(game.id, "");
      setJoiningViewerGameId(game.id);

      try {
        await joinGameAsViewer({
          gameId: game.id,
          source: "lobby",
        });
        router.push(`/woi/games/${game.id}`);
      } catch (joinError) {
        setGameActionError(
          game.id,
          getViewerJoinErrorMessage(joinError),
        );
      } finally {
        setJoiningViewerGameId((current) => (current === game.id ? null : current));
        void loadLobbyGames({ silent: true });
      }
    },
    [loadLobbyGames, router, setGameActionError],
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-900">Join by link</p>
        <p className="mt-1 text-xs text-slate-600">
          Paste a join link to open the role chooser (player or viewer).
        </p>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            setJoinLinkError(null);

            const parsed = parseJoinLinkInput(joinLinkInput);
            if (!parsed) {
              setJoinLinkError("Enter a valid join link.");
              return;
            }

            const params = new URLSearchParams({ token: parsed.token });
            router.push(`/woi/join/${parsed.gameId}?${params.toString()}`);
          }}
        >
          <input
            value={joinLinkInput}
            onChange={(event) => setJoinLinkInput(event.target.value)}
            placeholder="https://.../woi/join/<game-id>?token=..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Open link
          </button>
        </form>
        {joinLinkError ? <div className="mt-2"><InlineMessage kind="error">{joinLinkError}</InlineMessage></div> : null}
      </div>

      {error ? <InlineMessage kind="error">{error}</InlineMessage> : null}

      {loading ? <InlineMessage kind="info">Loading lobby games...</InlineMessage> : null}

      {!loading && !error && games.length === 0 ? (
        <InlineMessage kind="info">
          No listed lobby games are currently open for player joins.
        </InlineMessage>
      ) : null}

      {games.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {games.map((game) => {
            const playerJoinDisabled =
              (game.seatClaimsLocked || game.openHumanSeats <= 0) && !game.alreadyJoinedAsPlayer;
            const playerJoinInFlight = joiningPlayerGameId === game.id;
            const viewerJoinInFlight = joiningViewerGameId === game.id;

            return (
              <li key={game.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-base font-semibold text-slate-900">{game.question}</h3>
                {game.description ? (
                  <p className="mt-1 line-clamp-3 text-sm text-slate-600">{game.description}</p>
                ) : null}

                <dl className="mt-3 grid grid-cols-1 gap-1 text-xs text-slate-600 sm:grid-cols-2">
                  <div>
                    <dt className="font-semibold text-slate-700">Open player seats</dt>
                    <dd>{game.openHumanSeats}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-700">Status</dt>
                    <dd>{game.status}</dd>
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
                  <button
                    type="button"
                    onClick={() => void handleJoinAsPlayer(game)}
                    disabled={playerJoinDisabled || playerJoinInFlight}
                    className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {playerJoinInFlight
                      ? "Joining..."
                      : (game.alreadyJoinedAsPlayer ? "Enter as player" : "Join as player")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleJoinAsViewer(game)}
                    disabled={viewerJoinInFlight}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {viewerJoinInFlight ? "Joining..." : "Join as viewer"}
                  </button>
                  {game.joinLinkEnabled ? (
                    <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Link enabled
                    </span>
                  ) : null}
                </div>

                {gameActionErrors[game.id] ? (
                  <div className="mt-2">
                    <InlineMessage kind="error">{gameActionErrors[game.id] as string}</InlineMessage>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
