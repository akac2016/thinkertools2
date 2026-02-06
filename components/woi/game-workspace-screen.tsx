"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getDemoUserId } from "@/components/quipx/client";
import {
  fetchComments,
  fetchGameAiPack,
  fetchGameDetail,
  postComment,
  submitTurn,
  type ContextComment,
  type WoiGeneratedOpponent,
  type WoiGameAiPack,
  type WoiGameDetail,
} from "@/components/woi/client";
import { InlineMessage, WoiSection, WoiShell } from "@/components/woi/shell";

type WorkspaceTab = "play" | "reflect" | "comments" | "activity";

const workspaceTabs: Array<{ id: WorkspaceTab; label: string }> = [
  { id: "play", label: "Play" },
  { id: "reflect", label: "Reflect" },
  { id: "comments", label: "Comments" },
  { id: "activity", label: "Activity" },
];
const OPPONENTS_STORAGE_PREFIX = "woi-generated-opponents:";

function normalizeTab(value: string | null): WorkspaceTab {
  if (
    value === "play" ||
    value === "reflect" ||
    value === "comments" ||
    value === "activity"
  ) {
    return value;
  }

  return "play";
}

type SpinnerChoice = {
  id: string;
  value: string;
  label: string;
  subtitle?: string;
  imageUrl?: string;
  themeTopic?: string;
};

function randomChoice<T>(items: T[]): T | null {
  if (items.length === 0) {
    return null;
  }

  const index = Math.floor(Math.random() * items.length);
  return items[index] ?? null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

function assessResponseStrength(content: string, diceCount: 1 | 2): {
  strong: boolean;
  score: number;
  threshold: number;
} {
  const words = content
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const sentenceCount = content.split(/[.!?]+/).filter((part) => part.trim().length > 0).length;
  const hasReasoning = /\b(because|therefore|however|evidence|source|tradeoff|impact)\b/i.test(content);
  const hasSpecifics = /\d/.test(content) || /["']/g.test(content);

  let score = 0;
  score += Math.min(words.length / 28, 4);
  score += Math.min(sentenceCount, 3);
  score += hasReasoning ? 1.5 : 0;
  score += hasSpecifics ? 1 : 0;
  score += Math.random() * 0.8;

  const threshold = diceCount === 2 ? 6.2 : 4.8;
  return {
    strong: score >= threshold,
    score,
    threshold,
  };
}

function shouldExcludeMoveLabel(label: string): boolean {
  const normalized = label
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.includes("summarize groups findings")
    || normalized.includes("summarize the groups findings");
}

function buildFallbackMoveTileImage(topic: string, label: string): string {
  const source = `${topic}|${label}`;
  let seed = 0;
  for (let index = 0; index < source.length; index += 1) {
    seed = (seed * 31 + source.charCodeAt(index)) >>> 0;
  }

  const hueA = (seed % 70) + 14;
  const hueB = (hueA + 24) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="hsl(${hueA} 34% 86%)"/>
      <stop offset="100%" stop-color="hsl(${hueB} 24% 72%)"/>
    </linearGradient>
    <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="hsl(${(hueA + 180) % 360} 20% 73%)"/>
      <stop offset="100%" stop-color="hsl(${(hueB + 180) % 360} 22% 56%)"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#sky)"/>
  <rect y="238" width="512" height="274" fill="url(#water)"/>
  <path d="M0 220 C90 196, 162 206, 258 186 C334 171, 410 174, 512 156 L512 248 L0 248 Z" fill="rgba(255,255,255,0.22)"/>
  <path d="M0 300 C84 280, 158 290, 244 274 C332 257, 420 258, 512 240 L512 316 L0 336 Z" fill="rgba(160,142,120,0.26)"/>
  <rect x="20" y="20" width="472" height="472" rx="20" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.28)"/>
  <rect x="74" y="188" width="112" height="40" fill="rgba(245,236,218,0.24)"/>
  <rect x="86" y="228" width="16" height="78" fill="rgba(245,236,218,0.22)"/>
  <rect x="114" y="228" width="16" height="78" fill="rgba(245,236,218,0.22)"/>
  <rect x="142" y="228" width="16" height="78" fill="rgba(245,236,218,0.22)"/>
  <rect x="352" y="174" width="92" height="36" fill="rgba(245,236,218,0.2)"/>
  <rect x="364" y="210" width="12" height="60" fill="rgba(245,236,218,0.18)"/>
  <rect x="388" y="210" width="12" height="60" fill="rgba(245,236,218,0.18)"/>
  <rect x="412" y="210" width="12" height="60" fill="rgba(245,236,218,0.18)"/>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function SpinnerDeck({
  title,
  subtitle,
  choices,
  selectedValue,
  spinning,
  loading,
  loadingLabel,
  onSelect,
  onSpin,
}: {
  title: string;
  subtitle: string;
  choices: SpinnerChoice[];
  selectedValue: string;
  spinning: boolean;
  loading?: boolean;
  loadingLabel?: string;
  onSelect: (value: string) => void;
  onSpin: () => void;
}) {
  return (
    <div className="relative rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</p>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onSpin}
          disabled={spinning}
          className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {spinning ? "Spinning..." : "Spin"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {choices.map((choice) => {
          const selected = selectedValue === choice.value;
          return (
            <button
              key={choice.id}
              type="button"
              onClick={() => onSelect(choice.value)}
              className={[
                "overflow-hidden rounded-xl border text-left transition",
                selected
                  ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                  : "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100",
                spinning && selected ? "animate-pulse" : "",
              ].join(" ")}
            >
              <div className="relative aspect-square w-full overflow-hidden bg-slate-200">
                {choice.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={choice.imageUrl}
                    alt={choice.label}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col justify-between bg-gradient-to-br from-slate-900 via-sky-700 to-cyan-500 p-2">
                    <p className="line-clamp-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-100">
                      {choice.themeTopic || "Topic"}
                    </p>
                    <p className="line-clamp-3 text-xs font-semibold text-white">{choice.label}</p>
                  </div>
                )}
              </div>
              <div className="p-2">
                <p className="line-clamp-2 text-sm font-semibold">{choice.label}</p>
                {choice.subtitle ? (
                  <p className="mt-1 line-clamp-2 text-xs opacity-80">{choice.subtitle}</p>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/65 backdrop-blur-[1px]">
          <div className="flex flex-col items-center gap-2 animate-pulse">
            <svg
              viewBox="0 0 24 24"
              className="h-11 w-11 animate-spin text-slate-700 [animation-duration:1.8s]"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M7 3h10M7 21h10M8 4c0 3 2.5 4.8 4 6 1.5 1.2 4 3 4 6v4H8v-4c0-3 2.5-4.8 4-6 1.5-1.2 4-3 4-6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10 14h4l-2 3-2-3z"
                fill="currentColor"
                opacity="0.8"
              />
            </svg>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-700">
              {loadingLabel || "Loading Images"}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type PlayerLevelProgress = {
  playerId: string;
  playerName: string;
  levelIndex: number;
  isCurrentPlayer: boolean;
};

function LevelProgressBoard({
  levels,
  players,
  ladders,
  snakes,
  projectedLevelIndex,
  humanPlayerId,
}: {
  levels: Array<{ index: number }>;
  players: PlayerLevelProgress[];
  ladders: Map<number, number>;
  snakes: Map<number, number>;
  projectedLevelIndex: number | null;
  humanPlayerId: string;
}) {
  if (levels.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-sm text-slate-600">No levels configured for this game yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-emerald-50 via-cyan-50 to-sky-100 p-3">
      <div className="mb-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          Level Tracker
        </p>
        <p className="text-xs text-slate-600">
          Snakes & Ladders board showing each player&apos;s progression.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {levels.map((level) => {
          const playersOnLevel = players.filter((player) => player.levelIndex === level.index);
          return (
            <div
              key={level.index}
              className="rounded-lg border border-emerald-200 bg-white/80 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">
                  Level {level.index + 1}
                </p>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {ladders.has(level.index) ? (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                    Ladder to L{(ladders.get(level.index) ?? level.index) + 1}
                  </span>
                ) : null}
                {snakes.has(level.index) ? (
                  <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-800">
                    Snake to L{(snakes.get(level.index) ?? level.index) + 1}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 min-h-8">
                {playersOnLevel.length === 0 ? (
                  <p className="text-xs text-slate-400">No players here</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {playersOnLevel.map((player) => (
                      <span
                        key={player.playerId}
                        className={[
                          "rounded-full px-2 py-1 text-xs font-semibold",
                          player.isCurrentPlayer
                            ? "bg-slate-900 text-white"
                            : "bg-emerald-100 text-emerald-900",
                        ].join(" ")}
                      >
                        {player.playerName}
                      </span>
                    ))}
                    {projectedLevelIndex === level.index ? (
                      <span className="rounded-full bg-cyan-700 px-2 py-1 text-xs font-semibold text-white">
                        {
                          players.find((player) => player.playerId === humanPlayerId)?.playerName
                        }{" "}
                        next
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function WoiGameWorkspaceScreen({ gameId }: { gameId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeTab = normalizeTab(searchParams.get("tab"));
  const requestedAiPlayers = useMemo(() => {
    const raw = searchParams.get("aiPlayers");
    if (!raw) {
      return undefined;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return undefined;
    }

    return parsed;
  }, [searchParams]);

  const [game, setGame] = useState<WoiGameDetail | null>(null);
  const [comments, setComments] = useState<ContextComment[]>([]);

  const [loadingGame, setLoadingGame] = useState(true);
  const [gameError, setGameError] = useState<string | null>(null);

  const [loadingComments, setLoadingComments] = useState(true);
  const [commentsError, setCommentsError] = useState<string | null>(null);

  const demoUserId = getDemoUserId();

  const [content, setContent] = useState("");
  const [moveId, setMoveId] = useState("");
  const [diceCount, setDiceCount] = useState<1 | 2>(1);
  const [diceValues, setDiceValues] = useState<number[]>([]);
  const [diceTotal, setDiceTotal] = useState(0);
  const [diceOutcomeMessage, setDiceOutcomeMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [levelFilter, setLevelFilter] = useState<string>("all");

  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [aiPack, setAiPack] = useState<WoiGameAiPack | null>(null);
  const [aiPackLoading, setAiPackLoading] = useState(false);
  const [aiPackError, setAiPackError] = useState<string | null>(null);
  const [persistedOpponents, setPersistedOpponents] = useState<WoiGeneratedOpponent[]>([]);
  const [persistedAiPlayerCount, setPersistedAiPlayerCount] = useState<number | undefined>(
    undefined,
  );
  const [aiTurnPaused, setAiTurnPaused] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const spinIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setPersistedOpponents([]);
    setPersistedAiPlayerCount(undefined);
    try {
      const raw = window.sessionStorage.getItem(`${OPPONENTS_STORAGE_PREFIX}${gameId}`);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as {
        aiPlayerCount?: unknown;
        opponents?: unknown;
      };

      const parsedCount =
        typeof parsed.aiPlayerCount === "number" && Number.isFinite(parsed.aiPlayerCount)
          ? Math.max(0, Math.floor(parsed.aiPlayerCount))
          : undefined;
      const parsedOpponents = Array.isArray(parsed.opponents)
        ? parsed.opponents
            .map((entry) => {
              if (typeof entry !== "object" || entry === null) {
                return null;
              }
              const record = entry as Record<string, unknown>;
              const codename = typeof record.codename === "string" ? record.codename.trim() : "";
              const narrative =
                typeof record.narrative === "string" ? record.narrative.trim() : "";
              const intelligence =
                record.intelligence === "novice"
                || record.intelligence === "analytical"
                || record.intelligence === "strategic"
                || record.intelligence === "expert"
                  ? record.intelligence
                  : "analytical";
              const difficulty =
                record.difficulty === "easy"
                || record.difficulty === "medium"
                || record.difficulty === "hard"
                || record.difficulty === "adaptive"
                  ? record.difficulty
                  : "medium";
              const imageUrl = typeof record.imageUrl === "string" ? record.imageUrl : "";
              if (!codename || !narrative) {
                return null;
              }
              return {
                codename,
                narrative,
                intelligence,
                difficulty,
                imageUrl,
              } satisfies WoiGeneratedOpponent;
            })
            .filter((entry): entry is WoiGeneratedOpponent => Boolean(entry))
        : [];

      setPersistedAiPlayerCount(parsedCount);
      setPersistedOpponents(parsedOpponents);
    } catch {
      setPersistedOpponents([]);
      setPersistedAiPlayerCount(undefined);
    }
  }, [gameId]);

  const effectiveAiPlayerCount = useMemo(() => {
    if (typeof requestedAiPlayers === "number") {
      return requestedAiPlayers;
    }
    if (typeof persistedAiPlayerCount === "number") {
      return persistedAiPlayerCount;
    }
    if (persistedOpponents.length > 0) {
      return persistedOpponents.length;
    }
    return undefined;
  }, [persistedAiPlayerCount, persistedOpponents.length, requestedAiPlayers]);

  const loadGame = useCallback(async () => {
    setLoadingGame(true);
    setGameError(null);

    try {
      const detail = await fetchGameDetail(gameId);
      setGame(detail);
    } catch (loadError) {
      setGame(null);
      setGameError(loadError instanceof Error ? loadError.message : "Failed to load game");
    } finally {
      setLoadingGame(false);
    }
  }, [gameId]);

  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    setCommentsError(null);

    try {
      const nextComments = await fetchComments(gameId);
      setComments(nextComments);
    } catch (loadError) {
      setComments([]);
      setCommentsError(
        loadError instanceof Error ? loadError.message : "Failed to load comments",
      );
    } finally {
      setLoadingComments(false);
    }
  }, [gameId]);

  const loadAiPack = useCallback(
    async (regenerate = false) => {
      setAiPackLoading(true);
      setAiPackError(null);

      try {
        const nextPack = await fetchGameAiPack(
          gameId,
          regenerate ? crypto.randomUUID() : undefined,
          effectiveAiPlayerCount,
        );
        setAiPack(nextPack);
      } catch (loadError) {
        setAiPackError(
          loadError instanceof Error ? loadError.message : "Failed to generate AI gameplay pack",
        );
      } finally {
        setAiPackLoading(false);
      }
    },
    [effectiveAiPlayerCount, gameId],
  );

  useEffect(() => {
    void loadGame();
    void loadComments();

    const intervalId = window.setInterval(() => {
      if (aiTurnPaused) {
        return;
      }
      void loadGame();
      void loadComments();
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [aiTurnPaused, loadComments, loadGame]);

  useEffect(() => {
    if (activeTab !== "play" || aiPack || aiPackLoading) {
      return;
    }

    void loadAiPack(false);
  }, [activeTab, aiPack, aiPackLoading, loadAiPack]);

  useEffect(() => {
    setAiPack(null);
    setAiPackError(null);
    setAiTurnPaused(false);
    setSpinning(false);
    if (spinIntervalRef.current !== null) {
      window.clearInterval(spinIntervalRef.current);
      spinIntervalRef.current = null;
    }
  }, [gameId]);

  useEffect(() => {
    return () => {
      if (spinIntervalRef.current !== null) {
        window.clearInterval(spinIntervalRef.current);
      }
    };
  }, []);

  const levelOptions = useMemo(() => {
    const options = new Set<number>();

    for (const level of game?.levels ?? []) {
      options.add(level.index);
    }

    for (const turn of game?.turns ?? []) {
      if (turn.levelIndex !== null) {
        options.add(turn.levelIndex);
      }
    }

    return Array.from(options)
      .sort((left, right) => left - right)
      .map((value) => ({ value, label: `Level ${value + 1}` }));
  }, [game?.levels, game?.turns]);

  const moveOptions = useMemo(
    () =>
      (game?.template?.moves ?? []).filter((option) => {
        return !shouldExcludeMoveLabel(option.label);
      }),
    [game?.template?.moves],
  );
  const moveSpinnerTopic = aiPack?.topic || game?.question || "Inquiry topic";

  const moveSpinnerChoices = useMemo<SpinnerChoice[]>(() => {
    if (aiPack?.spinner.moves.length) {
      return aiPack.spinner.moves
        .filter((tile) => {
          return !shouldExcludeMoveLabel(tile.label);
        })
        .map((tile, index) => ({
          id: tile.id || `move-${index + 1}`,
          value: tile.id || "",
          label: tile.label || `Move ${index + 1}`,
          imageUrl: tile.imageUrl || buildFallbackMoveTileImage(moveSpinnerTopic, tile.label || `Move ${index + 1}`),
          themeTopic: moveSpinnerTopic,
        }));
    }

    return moveOptions.map((option, index) => ({
      id: option.id || `move-${index + 1}`,
      value: option.id,
      label: option.label,
      imageUrl: buildFallbackMoveTileImage(moveSpinnerTopic, option.label),
      themeTopic: moveSpinnerTopic,
    }));
  }, [aiPack?.spinner.moves, moveOptions, moveSpinnerTopic]);

  const applySpinnerChoice = useCallback((value: string) => {
    setMoveId(value);
  }, []);

  const spinSelections = useCallback(
    () => {
      if (spinning) {
        return;
      }

      if (moveSpinnerChoices.length === 0) {
        return;
      }

      if (spinIntervalRef.current !== null) {
        window.clearInterval(spinIntervalRef.current);
        spinIntervalRef.current = null;
      }

      setSpinning(true);
      let tick = 0;
      const maxTicks = 10 + Math.floor(Math.random() * 10);

      spinIntervalRef.current = window.setInterval(() => {
        tick += 1;

        const choice = randomChoice(moveSpinnerChoices);
        if (choice) {
          applySpinnerChoice(choice.value);
        }

        if (tick >= maxTicks) {
          if (spinIntervalRef.current !== null) {
            window.clearInterval(spinIntervalRef.current);
            spinIntervalRef.current = null;
          }
          setSpinning(false);
        }
      }, 90);
    },
    [applySpinnerChoice, moveSpinnerChoices, spinning],
  );

  useEffect(() => {
    if (moveId && !moveOptions.some((option) => option.id === moveId)) {
      setMoveId("");
    }
  }, [moveId, moveOptions]);

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

  const turnsByLevel = useMemo(() => {
    const counts = new Map<string, number>();
    for (const turn of game?.turns ?? []) {
      const key = turn.levelIndex === null ? "No level" : `Level ${turn.levelIndex + 1}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return Array.from(counts.entries());
  }, [game?.turns]);

  const isCurrentPlayer =
    Boolean(game?.currentPlayer?.id) && game?.currentPlayer?.id === demoUserId;

  const humanTurnMessage = useMemo(() => {
    const turnsUntilHuman = aiPack?.turnForecast.turnsUntilHuman ?? null;
    if (turnsUntilHuman === null) {
      return "You are viewing as observer for this team.";
    }
    if (turnsUntilHuman === 0) {
      return "It is your turn now.";
    }
    if (turnsUntilHuman === 1) {
      return "You are up next.";
    }
    return `Your turn is in ${turnsUntilHuman} turns.`;
  }, [aiPack?.turnForecast.turnsUntilHuman]);

  const currentQueuePlayer = useMemo(
    () => aiPack?.aiPlayers.find((player) => player.isCurrent) ?? aiPack?.aiPlayers[0] ?? null,
    [aiPack?.aiPlayers],
  );
  const isAiTurnNow = Boolean(currentQueuePlayer && !currentQueuePlayer.isHuman);

  useEffect(() => {
    if (!isAiTurnNow) {
      setAiTurnPaused(false);
    }
  }, [isAiTurnNow]);

  const persistedOpponentByUserId = useMemo(() => {
    const map = new Map<string, WoiGeneratedOpponent>();
    if (!game?.players?.length || persistedOpponents.length === 0) {
      return map;
    }

    const aiPlayers = game.players.filter((player) => player.id !== demoUserId);
    aiPlayers.forEach((player, index) => {
      const profile = persistedOpponents[index];
      if (profile) {
        map.set(player.id, profile);
      }
    });

    return map;
  }, [demoUserId, game?.players, persistedOpponents]);

  const levelBoard = useMemo(() => {
    const maxFromLevels = Math.max(-1, ...(game?.levels ?? []).map((level) => level.index));
    const maxFromTurns = Math.max(
      -1,
      ...(game?.turns ?? [])
        .map((turn) => turn.levelIndex)
        .filter((value): value is number => value !== null),
    );
    const maxLevelIndex = Math.max(maxFromLevels, maxFromTurns, 0);

    const levels = Array.from({ length: maxLevelIndex + 1 }, (_, index) => ({ index }));

    const latestLevelByPlayerId = new Map<string, { levelIndex: number; createdAt: number }>();
    for (const turn of game?.turns ?? []) {
      if (turn.levelIndex === null || !turn.player?.id) {
        continue;
      }
      const existing = latestLevelByPlayerId.get(turn.player.id);
      const createdAt = Date.parse(turn.createdAt);
      if (!existing || createdAt >= existing.createdAt) {
        latestLevelByPlayerId.set(turn.player.id, {
          levelIndex: turn.levelIndex,
          createdAt: Number.isFinite(createdAt) ? createdAt : 0,
        });
      }
    }

    const defaultLevel = levels[0]?.index ?? 0;
    const players: PlayerLevelProgress[] = (game?.players ?? []).map((player) => ({
      playerId: player.id,
      playerName: player.name,
      levelIndex: latestLevelByPlayerId.get(player.id)?.levelIndex ?? defaultLevel,
      isCurrentPlayer: player.id === game?.currentPlayer?.id,
    }));

    const ladders = new Map<number, number>();
    const snakes = new Map<number, number>();
    if (maxLevelIndex >= 3) {
      ladders.set(0, Math.min(2, maxLevelIndex));
    }
    if (maxLevelIndex >= 5) {
      ladders.set(1, Math.min(4, maxLevelIndex));
      snakes.set(4, 2);
    }
    if (maxLevelIndex >= 7) {
      ladders.set(3, Math.min(6, maxLevelIndex));
      snakes.set(6, 4);
    }

    const applyBoardTransition = (index: number) => {
      if (ladders.has(index)) {
        return ladders.get(index) ?? index;
      }
      if (snakes.has(index)) {
        return snakes.get(index) ?? index;
      }
      return index;
    };

    return {
      levels,
      players,
      maxLevelIndex,
      ladders,
      snakes,
      applyBoardTransition,
      humanLevelIndex:
        players.find((player) => player.playerId === demoUserId)?.levelIndex ?? defaultLevel,
    };
  }, [demoUserId, game?.currentPlayer?.id, game?.levels, game?.players, game?.turns]);

  const projectedTurnOutcome = useMemo(() => {
    if (diceTotal <= 0 || levelBoard.levels.length === 0) {
      return null;
    }

    const assessment = assessResponseStrength(content, diceCount);
    const direction = assessment.strong ? 1 : -1;
    const movedIndex = clamp(
      levelBoard.humanLevelIndex + direction * diceTotal,
      0,
      levelBoard.maxLevelIndex,
    );
    const finalIndex = levelBoard.applyBoardTransition(movedIndex);

    return {
      ...assessment,
      movedIndex,
      finalIndex,
      direction,
    };
  }, [
    content,
    diceCount,
    diceTotal,
    levelBoard,
  ]);

  const onSubmitTurn = async () => {
    if (!content.trim()) {
      setSubmitError("Turn text is required.");
      return;
    }
    if (diceTotal <= 0) {
      setSubmitError("Roll the dice before submitting.");
      return;
    }
    if (!projectedTurnOutcome) {
      setSubmitError("Unable to calculate level movement. Try rolling again.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      await submitTurn(gameId, {
        content: content.trim(),
        levelIndex: levelBoard.levels.length > 0 ? projectedTurnOutcome.finalIndex : null,
        moveId: moveId.trim(),
        ruleId: "",
      });

      const movementWord = projectedTurnOutcome.direction > 0 ? "forward" : "backward";
      setDiceOutcomeMessage(
        `AI assessment ${
          projectedTurnOutcome.strong ? "approved" : "rejected"
        } your response. You moved ${movementWord} ${diceTotal} level${
          diceTotal === 1 ? "" : "s"
        } to Level ${projectedTurnOutcome.finalIndex + 1}.`,
      );
      setContent("");
      setMoveId("");
      setDiceValues([]);
      setDiceTotal(0);
      await loadGame();
    } catch (turnError) {
      setSubmitError(turnError instanceof Error ? turnError.message : "Failed to submit turn");
    } finally {
      setSubmitting(false);
    }
  };

  const submitComment = async () => {
    const trimmed = newComment.trim();
    if (!trimmed) {
      return;
    }

    setPostingComment(true);
    setCommentsError(null);

    try {
      const created = await postComment(gameId, trimmed);
      setComments((previous) => [created, ...previous]);
      setNewComment("");
    } catch (createError) {
      setCommentsError(
        createError instanceof Error ? createError.message : "Failed to post comment",
      );
    } finally {
      setPostingComment(false);
    }
  };

  const setActiveTab = (nextTab: WorkspaceTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextTab === "play") {
      params.delete("tab");
    } else {
      params.set("tab", nextTab);
    }

    const suffix = params.toString();
    router.replace(suffix ? `${pathname}?${suffix}` : pathname);
  };

  return (
    <WoiShell
      title={game?.question ? `Workspace: ${game.question}` : "Game Workspace"}
      subtitle="Play, reflect, comment, and review activity without leaving this page."
    >
      {gameError ? <InlineMessage kind="error">{gameError}</InlineMessage> : null}

      <WoiSection
        title="Workspace"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/woi"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Games
            </Link>
            <Link
              href="/library"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Public library
            </Link>
            {workspaceTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={[
                  "rounded-md border px-3 py-2 text-xs font-medium transition",
                  activeTab === tab.id
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
                ].join(" ")}
              >
                {tab.label}
              </button>
            ))}
          </div>
        }
      >
        {loadingGame ? <InlineMessage kind="info">Loading game...</InlineMessage> : null}

        {activeTab === "play" ? (
          <div className="space-y-4">
            {game && !isCurrentPlayer ? (
              <InlineMessage kind="info">
                You are not the current player ({game.currentPlayer?.name ?? "unknown"}).
              </InlineMessage>
            ) : null}

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  AI Topic
                </p>
                <p className="mt-2 text-base font-semibold text-slate-900">
                  {aiPack?.topic || game?.question || "Game topic"}
                </p>
                <p className="mt-2 text-xs text-slate-500">{humanTurnMessage}</p>

                {aiPackError ? <InlineMessage kind="error">{aiPackError}</InlineMessage> : null}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    AI Players & Turn Queue
                  </p>
                  {isAiTurnNow ? (
                    <button
                      type="button"
                      onClick={() => setAiTurnPaused((previous) => !previous)}
                      className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      {aiTurnPaused ? "Resume AI turn" : "Pause AI turn"}
                    </button>
                  ) : null}
                </div>
                {aiPack?.aiPlayers.length ? (
                  <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {aiPack.aiPlayers.map((player) => (
                      <li
                        key={`${player.userId}-${player.turnOffset ?? 0}`}
                        className={[
                          "rounded-lg border px-3 py-3",
                          player.isCurrent
                            ? "border-emerald-400 bg-emerald-50"
                            : "border-slate-200 bg-white",
                        ].join(" ")}
                      >
                        <div className="flex h-full flex-col gap-3">
                          {(() => {
                            const persistedProfile =
                              !player.isHuman
                                ? (persistedOpponentByUserId.get(player.userId) ?? null)
                                : null;
                            const displayName =
                              player.isHuman
                                ? "You"
                                : (persistedProfile?.codename ?? player.displayName);
                            const description = player.isHuman
                              ? "Human player"
                              : (persistedProfile?.narrative ?? player.narrative ?? player.persona ?? "AI teammate");
                            const imageUrl = persistedProfile?.imageUrl ?? player.imageUrl ?? null;
                            return (
                              <>
                                <div className="aspect-[16/5] w-full overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                                  {imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={imageUrl}
                                      alt={`${displayName} portrait`}
                                      className="h-full w-full object-cover object-top"
                                      loading="lazy"
                                    />
                                  ) : player.isHuman ? (
                                    <div className="relative flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 via-sky-800 to-cyan-600">
                                      <div className="absolute h-24 w-24 rounded-full border-2 border-white/70" />
                                      <div className="absolute h-2 w-16 bg-white/80" />
                                      <div className="absolute h-16 w-2 bg-white/80" />
                                      <span className="absolute bottom-3 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-white">
                                        You
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="h-full w-full bg-slate-100" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-slate-900">{displayName}</p>
                                  <p className="mt-1 text-xs text-slate-600">
                                    {player.isCurrent
                                      ? "Now"
                                      : `in ${player.turnOffset ?? "?"} turn${(player.turnOffset ?? 0) === 1 ? "" : "s"}`}
                                  </p>
                                  <p className="mt-2 text-xs text-slate-600">{description}</p>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">
                    AI roster is loading...
                  </p>
                )}
                {isAiTurnNow && aiTurnPaused ? (
                  <InlineMessage kind="info">AI turn paused.</InlineMessage>
                ) : null}
              </div>
            </div>

            <LevelProgressBoard
              levels={levelBoard.levels}
              players={levelBoard.players}
              ladders={levelBoard.ladders}
              snakes={levelBoard.snakes}
              projectedLevelIndex={projectedTurnOutcome?.finalIndex ?? null}
              humanPlayerId={demoUserId}
            />

            <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-cyan-50 p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Move Spinner
                  </p>
                  <p className="text-xs text-slate-500">
                    Spin to pick a move. Rule spinner is replaced with dice roll.
                  </p>
                </div>
              </div>

              <SpinnerDeck
                title="Move Spinner"
                subtitle="Select action type"
                choices={moveSpinnerChoices}
                selectedValue={moveId}
                spinning={spinning}
                loading={aiPackLoading}
                loadingLabel="Rendering Move Art"
                onSelect={(value) => setMoveId(value)}
                onSpin={spinSelections}
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-amber-50 to-orange-100 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-800">
                    Dice Roll
                  </p>
                  <p className="text-xs text-amber-800/80">
                    Choose 1 die (safer) or 2 dice (higher reward, higher risk if response is weak).
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDiceCount(1)}
                    className={[
                      "rounded-md border px-3 py-1 text-xs font-semibold",
                      diceCount === 1
                        ? "border-amber-900 bg-amber-900 text-white"
                        : "border-amber-300 bg-white text-amber-900",
                    ].join(" ")}
                  >
                    1 Die
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiceCount(2)}
                    className={[
                      "rounded-md border px-3 py-1 text-xs font-semibold",
                      diceCount === 2
                        ? "border-amber-900 bg-amber-900 text-white"
                        : "border-amber-300 bg-white text-amber-900",
                    ].join(" ")}
                  >
                    2 Dice
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const values =
                        diceCount === 1 ? [rollDie()] : [rollDie(), rollDie()];
                      const total = values.reduce((sum, value) => sum + value, 0);
                      setDiceValues(values);
                      setDiceTotal(total);
                      setSubmitError(null);
                    }}
                    className="rounded-md bg-amber-900 px-3 py-1 text-xs font-semibold text-white transition hover:bg-amber-700"
                  >
                    Roll Dice
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-800">
                <span className="font-semibold">Rolled:</span>
                {diceValues.length > 0 ? (
                  <>
                    {diceValues.map((value, index) => (
                      <span
                        key={`${value}-${index}`}
                        className="rounded border border-amber-300 bg-white px-2 py-1 font-semibold"
                      >
                        {value}
                      </span>
                    ))}
                    <span className="rounded bg-amber-200 px-2 py-1 font-semibold">
                      Total {diceTotal}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-slate-600">Not rolled yet</span>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Current level: L{levelBoard.humanLevelIndex + 1}
              {projectedTurnOutcome
                ? ` • AI assessment ${
                    projectedTurnOutcome.strong ? "strong" : "weak"
                  } • projected level: L${projectedTurnOutcome.finalIndex + 1}`
                : " • roll dice to preview movement"}
            </p>
            {diceOutcomeMessage ? <InlineMessage kind="info">{diceOutcomeMessage}</InlineMessage> : null}

            <label className="block text-sm text-slate-700">
              <span className="mb-1 block">Turn text</span>
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={6}
                placeholder="Write this turn's contribution"
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
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit turn"}
            </button>
          </div>
        ) : null}

        {activeTab === "reflect" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Total turns
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{game?.turns.length ?? 0}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Levels used
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{turnsByLevel.length}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Visibility
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {game?.isPublic ? "Public" : "Private"}
                </p>
              </div>
            </div>

            <div>
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
          </div>
        ) : null}

        {activeTab === "comments" ? (
          <div className="space-y-3">
            {loadingComments ? <InlineMessage kind="info">Loading comments...</InlineMessage> : null}
            {commentsError ? <InlineMessage kind="error">{commentsError}</InlineMessage> : null}

            <label className="block text-sm text-slate-700">
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
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={postingComment}
            >
              {postingComment ? "Posting..." : "Post comment"}
            </button>

            {comments.length === 0 && !loadingComments ? (
              <p className="text-sm text-slate-600">No comments yet.</p>
            ) : null}

            {comments.length > 0 ? (
              <ul className="space-y-2">
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
          </div>
        ) : null}

        {activeTab === "activity" ? (
          <div className="space-y-3">
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

            {!loadingGame && filteredTurns.length === 0 ? (
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
          </div>
        ) : null}
      </WoiSection>
    </WoiShell>
  );
}
