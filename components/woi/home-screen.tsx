"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createQuickstartGame,
  fetchActorTeams,
  fetchTeamGames,
  formatDateTime,
  generateLearningQuestion,
  generateAiOpponents,
  type WoiGeneratedOpponent,
  type WoiGameSummary,
  type WoiTeamSummary,
} from "@/components/woi/client";
import { InlineMessage, WoiSection, WoiShell } from "@/components/woi/shell";

const TEAM_STORAGE_KEY = "woi-demo-team-id";
const OPPONENTS_STORAGE_PREFIX = "woi-generated-opponents:";
const PRESET_SUBJECTS = [
  "math",
  "history",
  "economics",
  "business",
  "philosophy",
  "science",
  "AI",
  "computer science",
];

function VibratingLoaderIcon({ className = "" }: { className?: string }) {
  return (
    <span
      className={`woi-vibrate inline-flex h-4 w-4 items-center justify-center rounded-full border border-current ${className}`}
      aria-hidden="true"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
    </span>
  );
}

function SandwatchLoaderTile() {
  return (
    <article className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
      <span
        className="woi-pulse mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current stroke-2">
          <path d="M7 3h10" />
          <path d="M7 21h10" />
          <path d="M8 3c0 4 3 4 4 6-1 2-4 2-4 6" />
          <path d="M16 3c0 4-3 4-4 6 1 2 4 2 4 6" />
          <path d="M9.5 8.5h5" />
          <path d="M9.5 15.5h5" />
        </svg>
      </span>
      <p className="text-sm font-semibold text-slate-900">Your opponents are are joining</p>
    </article>
  );
}

export function WoiHomeScreen() {
  const router = useRouter();

  const [teamId, setTeamId] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [teams, setTeams] = useState<WoiTeamSummary[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [games, setGames] = useState<WoiGameSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quickstartPrompt, setQuickstartPrompt] = useState("");
  const [quickstartAiPlayers, setQuickstartAiPlayers] = useState(2);
  const [generatedOpponents, setGeneratedOpponents] = useState<WoiGeneratedOpponent[]>([]);
  const [opponentsLoading, setOpponentsLoading] = useState(false);
  const [opponentsError, setOpponentsError] = useState<string | null>(null);
  const [quickstartLoading, setQuickstartLoading] = useState(false);
  const [quickstartError, setQuickstartError] = useState<string | null>(null);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [finalizingSubject, setFinalizingSubject] = useState(false);
  const opponentsRequestRef = useRef(0);

  const loadGames = useCallback(async (incomingTeamId: string) => {
    const normalizedTeamId = incomingTeamId.trim();
    if (!normalizedTeamId) {
      setError("Select a team to load WOI games.");
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

    const loadTeams = async () => {
      setTeamsLoading(true);
      try {
        const nextTeams = await fetchActorTeams();
        setTeams(nextTeams);

        const storedTeamId = window.localStorage.getItem(TEAM_STORAGE_KEY)?.trim() ?? "";
        const preferredTeamId = nextTeams.some((team) => team.id === storedTeamId)
          ? storedTeamId
          : (nextTeams[0]?.id ?? "");

        if (preferredTeamId) {
          setTeamId(preferredTeamId);
          void loadGames(preferredTeamId);
        }
      } catch (loadTeamsError) {
        setError(loadTeamsError instanceof Error ? loadTeamsError.message : "Failed to load teams");
        setTeams([]);
      } finally {
        setTeamsLoading(false);
      }
    };

    void loadTeams();
  }, [loadGames]);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === teamId) ?? null,
    [teamId, teams],
  );

  const filteredTeams = useMemo(() => {
    const needle = teamFilter.trim().toLowerCase();
    if (!needle) {
      return teams;
    }

    return teams.filter((team) => team.name.toLowerCase().includes(needle));
  }, [teamFilter, teams]);

  const newGameHref = useMemo(() => {
    const params = new URLSearchParams();
    if (teamId.trim()) {
      params.set("teamId", teamId.trim());
    }

    const suffix = params.toString() ? `?${params.toString()}` : "";
    return `/woi/games/new${suffix}`;
  }, [teamId]);

  const refreshOpponents = useCallback(
    async (count: number) => {
      const requestId = opponentsRequestRef.current + 1;
      opponentsRequestRef.current = requestId;
      setOpponentsError(null);
      if (count === 0) {
        setGeneratedOpponents([]);
        return;
      }

      setOpponentsLoading(true);
      setGeneratedOpponents([]);
      try {
        const opponents = await generateAiOpponents({
          count,
          prompt: quickstartPrompt.trim() || undefined,
          regenerateNonce: crypto.randomUUID(),
        });
        if (opponentsRequestRef.current !== requestId) {
          return;
        }
        setGeneratedOpponents(opponents);
      } catch (loadError) {
        if (opponentsRequestRef.current !== requestId) {
          return;
        }
        setGeneratedOpponents([]);
        setOpponentsError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to generate AI personalities",
        );
      } finally {
        if (opponentsRequestRef.current === requestId) {
          setOpponentsLoading(false);
        }
      }
    },
    [quickstartPrompt],
  );

  useEffect(() => {
    void refreshOpponents(quickstartAiPlayers);
  }, [quickstartAiPlayers, refreshOpponents]);

  const finalizeSubject = useCallback(async () => {
    const inputSubject = selectedSubject.trim();
    if (!inputSubject) {
      setSubjectsError("Pick a subject first.");
      return;
    }

    setFinalizingSubject(true);
    setSubjectsError(null);
    try {
      const payload = await generateLearningQuestion({ subject: inputSubject });
      setSelectedSubject(payload.subject);
      setQuickstartPrompt(payload.question);
    } catch (finalizeError) {
      setSubjectsError(
        finalizeError instanceof Error
          ? finalizeError.message
          : "Failed to generate learning question",
      );
    } finally {
      setFinalizingSubject(false);
    }
  }, [selectedSubject]);

  const startQuickstartGame = useCallback(async () => {
    setQuickstartLoading(true);
    setQuickstartError(null);

    try {
      const aiPlayers =
        Number.isFinite(quickstartAiPlayers) && quickstartAiPlayers >= 0
          ? quickstartAiPlayers
          : 2;
      const createdGame = await createQuickstartGame({
        prompt: quickstartPrompt.trim() || undefined,
        teamId: teamId.trim() || undefined,
        aiPlayerCount: aiPlayers,
        opponents: generatedOpponents.slice(0, aiPlayers),
      });
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.setItem(
            `${OPPONENTS_STORAGE_PREFIX}${createdGame.id}`,
            JSON.stringify({
              aiPlayerCount: aiPlayers,
              opponents: generatedOpponents.slice(0, aiPlayers),
            }),
          );
        } catch {
          // Ignore storage write failures; game creation should still proceed.
        }
      }

      const params = new URLSearchParams();
      params.set("aiPlayers", String(aiPlayers));
      router.push(`/woi/games/${createdGame.id}?${params.toString()}`);
    } catch (createError) {
      setQuickstartError(
        createError instanceof Error ? createError.message : "Failed to start AI game",
      );
    } finally {
      setQuickstartLoading(false);
    }
  }, [generatedOpponents, quickstartAiPlayers, quickstartPrompt, router, teamId]);

  return (
    <WoiShell
      title="Game Dashboard"
      subtitle="Load a team, review active games, and launch play or reflection."
    >
      <WoiSection title="Start With AI">
        <p className="mb-3 text-sm text-slate-600">
          Describe what you want to explore, and we will generate a playable WOI game instantly.
        </p>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!quickstartLoading) {
              void startQuickstartGame();
            }
          }}
        >
          <label className="block text-sm text-slate-700">
            <span className="mb-1 block">Game topic</span>
            <input
              value={quickstartPrompt}
              onChange={(event) => setQuickstartPrompt(event.target.value)}
              placeholder="e.g., What evidence best supports human-caused climate change?"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            />
          </label>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {PRESET_SUBJECTS.map((subject) => {
                const isActive = selectedSubject === subject;
                return (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => setSelectedSubject(subject)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      isActive
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {subject}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void finalizeSubject()}
                disabled={!selectedSubject.trim() || finalizingSubject}
                className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {finalizingSubject
                  ? "Generating..."
                  : "Generate question to learn about"}
              </button>
            </div>
            {subjectsError ? <InlineMessage kind="error">{subjectsError}</InlineMessage> : null}
          </div>
          <label className="block text-sm text-slate-700">
            <span className="mb-1 block">AI opponents</span>
            <div className="grid grid-cols-5 gap-2">
              {[0, 1, 2, 3, 4].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setQuickstartAiPlayers(count)}
                  className={`rounded-lg border px-2 py-2 text-sm font-semibold transition ${
                    quickstartAiPlayers === count
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </label>
          {quickstartAiPlayers > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  AI personalities & levels
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {opponentsLoading
                  ? Array.from({ length: Math.max(1, quickstartAiPlayers) }, (_, index) => (
                      <SandwatchLoaderTile key={`joining-${index + 1}`} />
                    ))
                  : generatedOpponents.map((opponent, index) => (
                      <article key={`${opponent.codename}-${index}`} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                        <div className="relative aspect-[4/3] w-full bg-gradient-to-b from-slate-200 to-slate-100">
                          {opponent.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={opponent.imageUrl}
                              alt={`${opponent.codename} portrait`}
                              className="h-full w-full object-contain p-1 transition duration-500 hover:scale-[1.02]"
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-full w-full bg-gradient-to-br from-slate-300 to-slate-200" />
                          )}
                        </div>
                        <div className="p-3">
                        <p className="text-sm font-semibold text-slate-900">{opponent.codename}</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-700">{opponent.narrative}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full bg-slate-200 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                            IQ: {opponent.intelligence}
                          </span>
                          <span className="rounded-full bg-slate-900 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                            Difficulty: {opponent.difficulty}
                          </span>
                        </div>
                        </div>
                      </article>
                    ))}
              </div>
              {opponentsError ? <InlineMessage kind="error">{opponentsError}</InlineMessage> : null}
            </div>
          ) : (
            <InlineMessage kind="info">Solo mode selected. No AI opponents.</InlineMessage>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={quickstartLoading}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              aria-label="Play AI game"
              title="Play AI game"
            >
              {quickstartLoading ? (
                <VibratingLoaderIcon className="text-white" />
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                  <path d="M8 5v14l11-7-11-7z" />
                </svg>
              )}
            </button>
            {quickstartAiPlayers > 0 ? (
              <button
                type="button"
                onClick={() => void refreshOpponents(quickstartAiPlayers)}
                disabled={opponentsLoading || quickstartLoading}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label={opponentsLoading ? "Shuffling AI opponents" : "Shuffle AI opponents"}
                title={opponentsLoading ? "Shuffling..." : "Shuffle AI opponents"}
              >
                {opponentsLoading ? (
                  <VibratingLoaderIcon className="text-slate-700" />
                ) : (
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2" aria-hidden="true">
                    <path d="M16 3h5v5" />
                    <path d="M4 20 21 3" />
                    <path d="M21 16v5h-5" />
                    <path d="M15 15 21 21" />
                    <path d="M4 4 9 9" />
                  </svg>
                )}
              </button>
            ) : null}
            <span className="text-xs text-slate-500">
              Team: {selectedTeam?.name ?? "first available team"}
            </span>
          </div>
        </form>

        {quickstartError ? <InlineMessage kind="error">{quickstartError}</InlineMessage> : null}
      </WoiSection>

      <WoiSection title="Team Games">
        <form
          className="mb-3 flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void loadGames(teamId);
          }}
        >
          <label className="text-sm text-slate-700">
            <span className="mb-1 block">Find team</span>
            <input
              value={teamFilter}
              onChange={(event) => setTeamFilter(event.target.value)}
              placeholder="Search teams by name"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            />
          </label>

          <div className="max-h-40 overflow-auto rounded-lg border border-slate-200 bg-white p-2">
            {teamsLoading ? (
              <p className="text-sm text-slate-500">Loading teams...</p>
            ) : null}
            {!teamsLoading && filteredTeams.length === 0 ? (
              <p className="text-sm text-slate-500">No teams match this filter.</p>
            ) : null}
            {!teamsLoading && filteredTeams.length > 0 ? (
              <ul className="space-y-2">
                {filteredTeams.map((team) => (
                  <li key={team.id}>
                    <button
                      type="button"
                      onClick={() => setTeamId(team.id)}
                      className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                        team.id === teamId
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                      }`}
                    >
                      {team.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {selectedTeam ? (
            <p className="text-sm text-slate-600">
              Selected team: <span className="font-semibold text-slate-900">{selectedTeam.name}</span>
            </p>
          ) : null}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!teamId || loading}
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
            No games found. Create one or choose another team.
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
      <style jsx>{`
        .woi-vibrate {
          animation: woi-vibrate 120ms linear infinite;
          transform-origin: 50% 50%;
        }

        @keyframes woi-vibrate {
          0% {
            transform: translate(0px, 0px) rotate(0deg);
          }
          25% {
            transform: translate(1px, -1px) rotate(-1.2deg);
          }
          50% {
            transform: translate(-1px, 1px) rotate(1.2deg);
          }
          75% {
            transform: translate(1px, 1px) rotate(-0.8deg);
          }
          100% {
            transform: translate(0px, 0px) rotate(0deg);
          }
        }

        .woi-pulse {
          animation: woi-pulse 900ms ease-in-out infinite;
        }

        @keyframes woi-pulse {
          0% {
            transform: scale(0.92);
            opacity: 0.7;
          }
          50% {
            transform: scale(1);
            opacity: 1;
          }
          100% {
            transform: scale(0.92);
            opacity: 0.7;
          }
        }
      `}</style>
    </WoiShell>
  );
}
