"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createGameWithSlots,
  fetchActorTeams,
  fetchTeamMembers,
  fetchTemplates,
  generateAiOpponents,
  generateLearningQuestion,
  searchWoiUsers,
  type WoiGeneratedOpponent,
  type WoiHumanSeatInstructionInput,
  type WoiTeamSummary,
  type WoiUserSearchResult,
} from "@/components/woi/client";
import { WoiLobbyScreen } from "@/components/woi/lobby-screen";
import { InlineMessage, WoiSection, WoiShell } from "@/components/woi/shell";

const TEAM_STORAGE_KEY = "woi-demo-team-id";
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

type HumanSeatMode = "platform_user" | "email" | "open";

type HumanSeatDraft = {
  id: string;
  isAi: boolean;
  mode: HumanSeatMode;
  selectedUser: WoiUserSearchResult | null;
  email: string;
  searchQuery: string;
  searchResults: WoiUserSearchResult[];
  searchLoading: boolean;
  searchError: string | null;
};

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
      <p className="text-sm font-semibold text-slate-900">AI Player is joining...</p>
    </article>
  );
}

function createEmptySeatDraft(): HumanSeatDraft {
  return {
    id: `seat-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`,
    isAi: false,
    mode: "open",
    selectedUser: null,
    email: "",
    searchQuery: "",
    searchResults: [],
    searchLoading: false,
    searchError: null,
  };
}

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function WoiHomeScreen() {
  const router = useRouter();
  const [entryMode, setEntryMode] = useState<"new" | "existing">("new");

  const [teamId, setTeamId] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [teams, setTeams] = useState<WoiTeamSummary[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [liveGameCount, setLiveGameCount] = useState(0);

  const [quickstartPrompt, setQuickstartPrompt] = useState("");
  const [subjectsError, setSubjectsError] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [finalizingSubject, setFinalizingSubject] = useState(false);

  const [totalPlayers, setTotalPlayers] = useState(4);
  const [aiPlayers, setAiPlayers] = useState(2);
  const [generatedOpponents, setGeneratedOpponents] = useState<WoiGeneratedOpponent[]>([]);
  const [opponentsLoading, setOpponentsLoading] = useState(false);
  const [opponentsError, setOpponentsError] = useState<string | null>(null);
  const [rerollingOpponentIndexes, setRerollingOpponentIndexes] = useState<number[]>([]);
  const [humanSeats, setHumanSeats] = useState<HumanSeatDraft[]>([]);

  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [teamMembers, setTeamMembers] = useState<WoiUserSearchResult[]>([]);
  const opponentsRequestRef = useRef(0);
  const seatSearchDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const searchDebounceTimers = seatSearchDebounceRef.current;
    return () => {
      Object.values(searchDebounceTimers).forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
    };
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
        }
      } catch {
        setTeams([]);
      } finally {
        setTeamsLoading(false);
      }
    };

    void loadTeams();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const normalizedTeamId = teamId.trim();
    if (normalizedTeamId) {
      window.localStorage.setItem(TEAM_STORAGE_KEY, normalizedTeamId);
    }
  }, [teamId]);

  useEffect(() => {
    const maxAi = Math.min(4, totalPlayers);
    if (aiPlayers > maxAi) {
      setAiPlayers(maxAi);
    }
  }, [aiPlayers, totalPlayers]);

  useEffect(() => {
    if (aiPlayers === 0) {
      setGeneratedOpponents([]);
      setOpponentsError(null);
      setRerollingOpponentIndexes([]);
      return;
    }

    setGeneratedOpponents((previous) => previous.slice(0, aiPlayers));
  }, [aiPlayers]);

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

  const selectTeam = useCallback((nextTeamId: string) => {
    setTeamId(nextTeamId);
    setTeamFilter("");
  }, []);

  const creatorRole = "viewer" as const;
  const humanSlots = Math.max(0, totalPlayers - aiPlayers);
  const rosterSpotCount = totalPlayers;

  useEffect(() => {
    setHumanSeats((previous) => {
      const next = [...previous];
      if (next.length > rosterSpotCount) {
        next.splice(rosterSpotCount);
      }
      while (next.length < rosterSpotCount) {
        next.push(createEmptySeatDraft());
      }
      return next;
    });
  }, [rosterSpotCount]);

  useEffect(() => {
    const normalizedTeamId = teamId.trim();
    if (!normalizedTeamId) {
      setTeamMembers([]);
      return;
    }

    let cancelled = false;
    const loadTeamMembers = async () => {
      try {
        const nextTeamMembers = await fetchTeamMembers(normalizedTeamId);
        if (cancelled) {
          return;
        }

        setTeamMembers(nextTeamMembers);
      } catch {
        if (cancelled) {
          return;
        }
        setTeamMembers([]);
      }
    };

    void loadTeamMembers();
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const updateSeat = useCallback(
    (seatId: string, updater: (seat: HumanSeatDraft) => HumanSeatDraft) => {
      setHumanSeats((previous) =>
        previous.map((seat) => (seat.id === seatId ? updater(seat) : seat)),
      );
    },
    [],
  );

  const applyAiPlayers = useCallback((count: number) => {
    const normalizedCount = Math.max(0, Math.min(4, Math.min(totalPlayers, count)));
    setHumanSeats((previous) => {
      const aiStartIndex = Math.max(0, previous.length - normalizedCount);
      return previous.map((seat, index) => ({
        ...seat,
        isAi: index >= aiStartIndex,
      }));
    });
    setAiPlayers(normalizedCount);
  }, [totalPlayers]);

  useEffect(() => {
    const currentAiCount = humanSeats.filter((seat) => seat.isAi).length;
    const normalizedAiCount = Math.max(0, Math.min(4, Math.min(totalPlayers, currentAiCount)));
    if (aiPlayers !== normalizedAiCount) {
      setAiPlayers(normalizedAiCount);
    }
  }, [aiPlayers, humanSeats, totalPlayers]);

  const setSeatAi = useCallback((seatId: string, nextIsAi: boolean) => {
    setHumanSeats((previous) => {
      const currentAiCount = previous.filter((seat) => seat.isAi).length;
      return previous.map((seat) => {
        if (seat.id !== seatId) {
          return seat;
        }
        if (seat.isAi === nextIsAi) {
          return seat;
        }
        if (nextIsAi && currentAiCount >= 4) {
          return seat;
        }
        return {
          ...seat,
          isAi: nextIsAi,
          mode: nextIsAi ? "open" : seat.mode,
          selectedUser: nextIsAi ? null : seat.selectedUser,
          email: nextIsAi ? "" : seat.email,
          searchResults: nextIsAi ? [] : seat.searchResults,
          searchLoading: false,
          searchError: null,
        };
      });
    });
  }, []);

  const handleSeatQueryChange = useCallback(
    (seatId: string, value: string) => {
      const nextValue = value;
      const trimmedValue = nextValue.trim();
      const normalizedTeamId = teamId.trim() || undefined;

      if (seatSearchDebounceRef.current[seatId]) {
        clearTimeout(seatSearchDebounceRef.current[seatId]);
      }

      updateSeat(seatId, (current) => {
        if (current.isAi) {
          return current;
        }
        const keepSelectedUser = current.selectedUser?.name === nextValue;
        const nextMode: HumanSeatMode = trimmedValue
          ? looksLikeEmail(trimmedValue)
            ? "email"
            : "platform_user"
          : "open";
        return {
          ...current,
          mode: nextMode,
          selectedUser: keepSelectedUser ? current.selectedUser : null,
          email: looksLikeEmail(trimmedValue) ? trimmedValue : "",
          searchQuery: nextValue,
          searchResults: trimmedValue.length < 2 || looksLikeEmail(trimmedValue) ? [] : current.searchResults,
          searchLoading: false,
          searchError: null,
        };
      });

      if (!normalizedTeamId || trimmedValue.length < 2 || looksLikeEmail(trimmedValue)) {
        return;
      }

      seatSearchDebounceRef.current[seatId] = setTimeout(async () => {
        updateSeat(seatId, (current) =>
          current.searchQuery.trim() === trimmedValue
            ? { ...current, searchLoading: true, searchError: null }
            : current,
        );

        try {
          const results = await searchWoiUsers({
            query: trimmedValue,
            teamId: normalizedTeamId,
            limit: 8,
          });
          updateSeat(seatId, (current) =>
            current.searchQuery.trim() === trimmedValue && !looksLikeEmail(current.searchQuery.trim())
              ? { ...current, searchLoading: false, searchResults: results, searchError: null }
              : current,
          );
        } catch (searchError) {
          updateSeat(seatId, (current) =>
            current.searchQuery.trim() === trimmedValue
              ? {
                  ...current,
                  searchLoading: false,
                  searchResults: [],
                  searchError:
                    searchError instanceof Error ? searchError.message : "Failed to search users",
                }
              : current,
          );
        }
      }, 250);
    },
    [teamId, updateSeat],
  );

  const selectedUserIds = useMemo(
    () =>
      new Set(
        humanSeats
          .filter((seat) => !seat.isAi)
          .map((seat) => seat.selectedUser?.id ?? "")
          .filter((value): value is string => Boolean(value)),
      ),
    [humanSeats],
  );

  const applyTeamPreset = useCallback(() => {
    setHumanSeats((previous) => {
      const editableIndexes = previous
        .map((entry, entryIndex) => (!entry.isAi ? entryIndex : -1))
        .filter((entryIndex) => entryIndex >= 0);
      return previous.map((seat, index) => {
        if (seat.isAi) {
          return seat;
        }
        const editableIndex = editableIndexes.indexOf(index);
        const candidate = editableIndex >= 0 ? teamMembers[editableIndex] : null;
        if (!candidate) {
          return {
            ...seat,
            mode: "open",
            selectedUser: null,
            email: "",
            searchQuery: "",
            searchResults: [],
            searchLoading: false,
            searchError: null,
          };
        }

        return {
          ...seat,
          mode: "platform_user",
          selectedUser: candidate,
          email: "",
          searchQuery: candidate.name,
          searchResults: [],
          searchLoading: false,
          searchError: null,
        };
      });
    });
  }, [teamMembers]);

  useEffect(() => {
    if (!teamId.trim()) {
      return;
    }
    applyTeamPreset();
  }, [applyTeamPreset, teamId]);

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

  const refreshOpponents = useCallback(async (count: number) => {
    const normalizedCount = Math.max(0, Math.min(4, Math.floor(count)));
    const requestId = opponentsRequestRef.current + 1;
    opponentsRequestRef.current = requestId;
    setOpponentsError(null);

    if (normalizedCount === 0) {
      setGeneratedOpponents([]);
      return;
    }

    setOpponentsLoading(true);
    try {
      const opponents = await generateAiOpponents({
        count: normalizedCount,
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
          : "Failed to generate AI opponents",
      );
    } finally {
      if (opponentsRequestRef.current === requestId) {
        setOpponentsLoading(false);
      }
    }
  }, [quickstartPrompt]);

  const rerollOpponent = useCallback(async (index: number) => {
    if (opponentsLoading || createLoading) {
      return;
    }

    const totalOpponents = generatedOpponents.length;
    if (index < 0 || index >= totalOpponents) {
      return;
    }

    setOpponentsError(null);
    setRerollingOpponentIndexes((previous) => (previous.includes(index) ? previous : [...previous, index]));
    try {
      const skinToneBuckets = Array.from(
        new Set(
          generatedOpponents
            .filter((_, opponentIndex) => opponentIndex !== index)
            .map((opponent) => opponent.appearance?.skinToneBucket)
            .filter((value): value is string => Boolean(value)),
        ),
      );
      const featureProfiles = Array.from(
        new Set(
          generatedOpponents
            .filter((_, opponentIndex) => opponentIndex !== index)
            .map((opponent) => opponent.appearance?.featureProfile)
            .filter((value): value is string => Boolean(value)),
        ),
      );
      const hairProfiles = Array.from(
        new Set(
          generatedOpponents
            .filter((_, opponentIndex) => opponentIndex !== index)
            .map((opponent) => opponent.appearance?.hairProfile)
            .filter((value): value is string => Boolean(value)),
        ),
      );

      const [replacement] = await generateAiOpponents({
        count: 1,
        prompt: quickstartPrompt.trim() || undefined,
        regenerateNonce: crypto.randomUUID(),
        usedAppearance: {
          skinToneBuckets,
          featureProfiles,
          hairProfiles,
        },
      });

      if (!replacement) {
        throw new Error("No replacement opponent was generated.");
      }

      setGeneratedOpponents((previous) =>
        previous.map((opponent, opponentIndex) =>
          opponentIndex === index ? replacement : opponent,
        ),
      );
    } catch (rerollError) {
      setOpponentsError(
        rerollError instanceof Error
          ? rerollError.message
          : "Failed to reroll AI opponent",
      );
    } finally {
      setRerollingOpponentIndexes((previous) => previous.filter((entry) => entry !== index));
    }
  }, [createLoading, generatedOpponents, opponentsLoading, quickstartPrompt]);

  const validateSeatBuilder = useCallback((): string | null => {
    const seenUserIds = new Set<string>();
    const seenEmails = new Set<string>();
    for (const seat of humanSeats) {
      if (seat.isAi) {
        continue;
      }
      const rawQuery = seat.searchQuery.trim();
      if (!rawQuery) {
        continue;
      }

      if (seat.selectedUser) {
        const invitedUserId = seat.selectedUser?.id?.trim() ?? "";
        if (!invitedUserId) {
          return "Pick a user from search results for each named roster spot.";
        }
        if (seenUserIds.has(invitedUserId)) {
          return "Duplicate platform users are not allowed.";
        }
        seenUserIds.add(invitedUserId);
        continue;
      }

      if (looksLikeEmail(rawQuery)) {
        const email = rawQuery.toLowerCase();
        if (!looksLikeEmail(email)) {
          return "Every email seat needs a valid email address.";
        }
        if (seenEmails.has(email)) {
          return "Duplicate invite emails are not allowed.";
        }
        seenEmails.add(email);
        continue;
      }

      return "Use a valid email or pick a user from search results for each filled roster spot.";
    }

    return null;
  }, [humanSeats]);

  const startSlotGame = useCallback(async () => {
    const validationError = validateSeatBuilder();
    if (validationError) {
      setCreateError(validationError);
      return;
    }

    const seatInstructions: WoiHumanSeatInstructionInput[] = humanSeats.map((seat) => {
      if (seat.isAi) {
        return { mode: "open" };
      }
      if (seat.selectedUser?.id) {
        return {
          mode: "platform_user",
          invitedUserId: seat.selectedUser.id,
        };
      }
      const emailCandidate = seat.searchQuery.trim();
      if (looksLikeEmail(emailCandidate)) {
        return {
          mode: "email",
          invitedEmail: emailCandidate,
        };
      }
      return { mode: "open" };
    });

    const openSeatCount = seatInstructions.filter((seat) => seat.mode === "open").length;
    const lobbyVisibility = openSeatCount > 0 ? "listed" : "hidden";
    const normalizedTeamId = teamId.trim();

    setCreateLoading(true);
    setCreateError(null);

    try {
      const templates = await fetchTemplates();
      const selectedTemplateId = templates[0]?.id ?? "";
      if (!selectedTemplateId) {
        throw new Error("No template is available for this actor.");
      }

      const normalizedPrompt = quickstartPrompt.trim();
      const question = normalizedPrompt || "What should this team investigate together?";

      const created = await createGameWithSlots({
        templateId: selectedTemplateId,
        teamId: normalizedTeamId || undefined,
        question,
        description: `Collaborative inquiry on: ${question}`,
        isPublic: false,
        totalPlayerSlots: totalPlayers,
        aiPlayerSlots: aiPlayers,
        creatorRole,
        humanSeats: seatInstructions,
        opponents: generatedOpponents.slice(0, aiPlayers),
        lobbyVisibility,
        joinLinkEnabled: openSeatCount > 0,
      });

      router.push(`/woi/games/${created.game.id}`);
    } catch (createErrorValue) {
      setCreateError(
        createErrorValue instanceof Error
          ? createErrorValue.message
          : "Failed to create game",
      );
    } finally {
      setCreateLoading(false);
    }
  }, [
    aiPlayers,
    creatorRole,
    generatedOpponents,
    humanSeats,
    quickstartPrompt,
    router,
    teamId,
    totalPlayers,
    validateSeatBuilder,
  ]);

  return (
    <WoiShell
      title="Game Dashboard"
      subtitle="Start a new game or join an existing one."
    >
      <WoiSection title="Start a new game or join an existing one">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setEntryMode("new")}
            className={`rounded-xl border p-5 text-left transition ${
              entryMode === "new"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-400 hover:bg-slate-100"
            }`}
          >
            <p className="text-base font-semibold">Start a new game</p>
            <p className={`mt-1 text-sm ${entryMode === "new" ? "text-slate-100" : "text-slate-600"}`}>
              Start a new game with others or AI
            </p>
          </button>
          <button
            type="button"
            onClick={() => setEntryMode("existing")}
            className={`rounded-xl border p-5 text-left transition ${
              entryMode === "existing"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-400 hover:bg-slate-100"
            }`}
          >
            <p className="inline-flex items-center gap-2 text-base font-semibold">
              Find an existing game
              <span
                className={`inline-flex min-w-7 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                  entryMode === "existing"
                    ? "bg-white/20 text-white"
                    : "bg-slate-900 text-white"
                }`}
                aria-live="polite"
              >
                {liveGameCount}
              </span>
            </p>
            <p
              className={`mt-1 text-sm ${entryMode === "existing" ? "text-slate-100" : "text-slate-600"}`}
            >
              Find current games to join and play
            </p>
          </button>
        </div>
      </WoiSection>

      {entryMode === "new" ? (
        <WoiSection title="Start a new game">
          <p className="mb-3 text-sm text-slate-600">
            Set your topic first, then choose who joins the game.
          </p>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!createLoading) {
                void startSlotGame();
              }
            }}
          >
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                  1
                </span>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Define what you want to learn</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Enter your topic manually, or choose a subject and generate a question with AI.
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-3">
                <label className="block text-sm text-slate-700">
                  <span className="mb-1 block">Game topic</span>
                  <input
                    value={quickstartPrompt}
                    onChange={(event) => setQuickstartPrompt(event.target.value)}
                    placeholder="e.g., What evidence best supports human-caused climate change?"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                  />
                </label>
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
                    {finalizingSubject ? "Generating..." : "Generate question with AI"}
                  </button>
                </div>
                {subjectsError ? <InlineMessage kind="error">{subjectsError}</InlineMessage> : null}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                  2
                </span>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Invite players and add AI opponents</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Configure seats, choose creator role, and set invite mode per human seat.
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                  <label className="block text-sm text-slate-700 lg:hidden">
                    <span className="mb-1 block">Total players</span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={totalPlayers}
                      onChange={(event) => {
                        const value = Number.parseInt(event.target.value, 10);
                        if (!Number.isFinite(value)) {
                          return;
                        }
                        setTotalPlayers(Math.max(1, Math.min(20, value)));
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                    />
                  </label>
                  <label className="relative text-sm text-slate-700">
                    <span className="mb-1 block">Invite from team</span>
                    <div className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition focus-within:border-slate-500">
                      {selectedTeam ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-1 text-xs font-semibold text-white">
                          {selectedTeam.name}
                          <button
                            type="button"
                            onClick={() => setTeamId("")}
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[10px] leading-none transition hover:bg-white/35"
                            aria-label="Clear selected team"
                          >
                            x
                          </button>
                        </span>
                      ) : null}
                      <input
                        value={teamFilter}
                        onChange={(event) => setTeamFilter(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" || teamsLoading) {
                            return;
                          }
                          const nextTeam = filteredTeams[0];
                          if (!nextTeam) {
                            return;
                          }
                          event.preventDefault();
                          selectTeam(nextTeam.id);
                        }}
                        placeholder="Search teams by name"
                        className="min-w-[180px] flex-1 border-0 bg-transparent p-0 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                      />
                    </div>
                    {teamFilter.trim() ? (
                      <div className="absolute z-20 mt-1 max-h-44 w-full overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
                        {teamsLoading ? <p className="px-2 py-2 text-xs text-slate-500">Loading teams...</p> : null}
                        {!teamsLoading && filteredTeams.length === 0 ? (
                          <p className="px-2 py-2 text-xs text-slate-500">No teams match this filter.</p>
                        ) : null}
                        {!teamsLoading && filteredTeams.length > 0 ? (
                          <ul className="space-y-1">
                            {filteredTeams.map((team) => (
                              <li key={team.id}>
                                <button
                                  type="button"
                                  onMouseDown={(event) => {
                                    event.preventDefault();
                                    selectTeam(team.id);
                                  }}
                                  onClick={() => selectTeam(team.id)}
                                  className={`w-full rounded-md px-2 py-2 text-left text-sm transition ${
                                    team.id === teamId
                                      ? "bg-slate-900 text-white"
                                      : "text-slate-800 hover:bg-slate-100"
                                  }`}
                                >
                                  {team.name}
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : null}
                  </label>

                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Roster spots
                    </p>
                    <p className="text-xs text-slate-500">
                      Search users or enter emails. AI-reserved spots are marked.
                    </p>
                    {rosterSpotCount === 0 ? (
                      <InlineMessage kind="info">No roster spots available.</InlineMessage>
                    ) : (
                      <div className="grid grid-cols-1 gap-2">
                        {Array.from({ length: rosterSpotCount }, (_, index) => {
                          const seat = humanSeats[index];
                          if (!seat) {
                            return null;
                          }

                          const currentAiCount = humanSeats.filter((entry) => entry.isAi).length;
                          const maxAiReached = currentAiCount >= 4;
                          const disableMakeAi = !seat.isAi && maxAiReached;
                          const toggleTitle = disableMakeAi
                            ? "max 4 ai players"
                            : seat.isAi
                              ? "Set this roster spot as human"
                              : "Set this roster spot as AI";

                          return (
                            <article key={seat.id} className={`rounded-lg border p-2 ${seat.isAi ? "border-slate-200 bg-slate-50" : "border-slate-200 bg-white"}`}>
                              <div className="flex items-center justify-between gap-2">
                                <h4 className="text-xs font-semibold text-slate-900">Spot {index + 1}</h4>
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setSeatAi(seat.id, false)}
                                    title="Set this roster spot as human"
                                    aria-label="Set this roster spot as human"
                                    className={`inline-flex h-7 w-7 items-center justify-center rounded-full border transition ${
                                      !seat.isAi
                                        ? "border-slate-900 bg-slate-900 text-white"
                                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                                    }`}
                                  >
                                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2" aria-hidden="true">
                                      <circle cx="12" cy="8" r="3" />
                                      <path d="M6 19c0-3.3 2.7-6 6-6s6 2.7 6 6" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setSeatAi(seat.id, true)}
                                    disabled={disableMakeAi}
                                    title={toggleTitle}
                                    aria-label="Set this roster spot as AI"
                                    className={`inline-flex h-7 w-7 items-center justify-center rounded-full border transition ${
                                      seat.isAi
                                        ? "border-slate-900 bg-slate-900 text-white"
                                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                                    } disabled:cursor-not-allowed disabled:opacity-50`}
                                  >
                                    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2" aria-hidden="true">
                                      <rect x="7" y="8" width="10" height="8" rx="2" />
                                      <path d="M12 4v2" />
                                      <path d="M9 8V6" />
                                      <path d="M15 8V6" />
                                      <circle cx="10" cy="12" r="1" />
                                      <circle cx="14" cy="12" r="1" />
                                      <path d="M10 15h4" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                              <div className="mt-1 space-y-1.5">
                                {seat.isAi ? (
                                  <p className="text-xs text-slate-600">Reserved for AI player</p>
                                ) : null}
                                {!seat.isAi ? (
                                  <input
                                    value={seat.searchQuery}
                                    onChange={(event) => handleSeatQueryChange(seat.id, event.target.value)}
                                    placeholder="Name or email"
                                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none transition focus:border-slate-500"
                                  />
                                ) : null}

                                {!seat.isAi && seat.selectedUser ? (
                                  <p className="text-xs text-slate-600">
                                    <span className="font-semibold text-slate-900">{seat.selectedUser.name}</span>
                                    {seat.selectedUser.email ? ` (${seat.selectedUser.email})` : ""}
                                  </p>
                                ) : null}
                                {!seat.isAi && !seat.selectedUser && looksLikeEmail(seat.searchQuery.trim()) ? (
                                  <p className="text-xs text-slate-600">
                                    <span className="font-semibold text-slate-900">{seat.searchQuery.trim()}</span>
                                  </p>
                                ) : null}

                                {!seat.isAi && seat.searchLoading ? (
                                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                                    <VibratingLoaderIcon className="text-slate-500" />
                                    Searching...
                                  </span>
                                ) : null}
                                {!seat.isAi && seat.searchError ? <InlineMessage kind="error">{seat.searchError}</InlineMessage> : null}

                                {!seat.isAi && !looksLikeEmail(seat.searchQuery.trim()) && seat.searchResults.length > 0 ? (
                                  <ul className="max-h-28 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-1">
                                    {seat.searchResults.map((user) => {
                                      const isSelected = seat.selectedUser?.id === user.id;
                                      const selectedElsewhere = selectedUserIds.has(user.id) && !isSelected;

                                      return (
                                        <li key={user.id}>
                                          <button
                                            type="button"
                                            disabled={selectedElsewhere}
                                            onMouseDown={(event) => {
                                              event.preventDefault();
                                              updateSeat(seat.id, (current) => ({
                                                ...current,
                                                mode: "platform_user",
                                                selectedUser: user,
                                                email: "",
                                                searchQuery: user.name,
                                                searchResults: [],
                                                searchLoading: false,
                                                searchError: null,
                                              }));
                                            }}
                                            className={`mb-1 w-full rounded-md px-2 py-1.5 text-left text-xs transition ${
                                              isSelected
                                                ? "bg-slate-900 text-white"
                                                : "bg-white text-slate-700 hover:bg-slate-100"
                                            } disabled:cursor-not-allowed disabled:opacity-50`}
                                          >
                                            <span className="font-semibold">{user.name}</span>
                                            {user.email ? <span className="block opacity-80">{user.email}</span> : null}
                                          </button>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                ) : null}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="hidden text-sm text-slate-700 lg:block">
                    <span className="mb-1 block">Total players</span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={totalPlayers}
                      onChange={(event) => {
                        const value = Number.parseInt(event.target.value, 10);
                        if (!Number.isFinite(value)) {
                          return;
                        }
                        setTotalPlayers(Math.max(1, Math.min(20, value)));
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                    />
                  </label>

                  <label className="block text-sm text-slate-700">
                    <span className="mb-1 block">AI players</span>
                    <div className="grid grid-cols-5 gap-2">
                      {[0, 1, 2, 3, 4].map((count) => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => applyAiPlayers(count)}
                          disabled={count > totalPlayers}
                          className={`rounded-lg border px-2 py-2 text-sm font-semibold transition ${
                            aiPlayers === count
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                          } disabled:cursor-not-allowed disabled:opacity-40`}
                        >
                          {count}
                        </button>
                      ))}
                    </div>
                  </label>

                  {aiPlayers > 0 ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          AI characters
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void refreshOpponents(aiPlayers)}
                            disabled={opponentsLoading || createLoading}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {opponentsLoading ? (
                              <>
                                <VibratingLoaderIcon className="text-slate-700" />
                                Generating...
                              </>
                            ) : (
                              "Generate AI characters"
                            )}
                          </button>
                          {generatedOpponents.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => void refreshOpponents(aiPlayers)}
                              disabled={opponentsLoading || createLoading}
                              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Shuffle
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {opponentsLoading
                          ? Array.from({ length: aiPlayers }, (_, index) => (
                              <SandwatchLoaderTile key={`opponent-loader-${index + 1}`} />
                            ))
                          : generatedOpponents.slice(0, aiPlayers).map((opponent, index) => (
                              <article key={`${opponent.codename}-${index}`} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                                <div className="relative flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-b from-slate-200 to-slate-100">
                                  {opponent.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={opponent.imageUrl}
                                      alt={`${opponent.codename} portrait`}
                                      className="h-full max-h-[92%] w-full object-contain transition duration-500 hover:scale-[1.02]"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="h-full w-full bg-gradient-to-br from-slate-300 to-slate-200" />
                                  )}
                                </div>
                                <div className="p-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-sm font-semibold text-slate-900">{opponent.codename}</p>
                                    <button
                                      type="button"
                                      onClick={() => void rerollOpponent(index)}
                                      disabled={opponentsLoading || createLoading || rerollingOpponentIndexes.includes(index)}
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                                      aria-label={rerollingOpponentIndexes.includes(index) ? `Rerolling ${opponent.codename}` : `Reroll ${opponent.codename}`}
                                      title={rerollingOpponentIndexes.includes(index) ? "Rerolling..." : "Reroll this AI character"}
                                    >
                                      {rerollingOpponentIndexes.includes(index) ? (
                                        <VibratingLoaderIcon className="text-slate-700" />
                                      ) : (
                                        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2" aria-hidden="true">
                                          <path d="M16 3h5v5" />
                                          <path d="M4 20 21 3" />
                                          <path d="M21 16v5h-5" />
                                          <path d="M15 15 21 21" />
                                          <path d="M4 4 9 9" />
                                        </svg>
                                      )}
                                    </button>
                                  </div>
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

                      {!opponentsLoading && generatedOpponents.length < aiPlayers ? (
                        <p className="mt-2 text-xs text-slate-500">
                          Generate AI characters to preview opponents before creating the game.
                        </p>
                      ) : null}
                      {opponentsError ? <InlineMessage kind="error">{opponentsError}</InlineMessage> : null}
                    </div>
                  ) : (
                    <InlineMessage kind="info">No AI opponents selected.</InlineMessage>
                  )}
                </div>
              </div>

            </section>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={createLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {createLoading ? (
                  <>
                    <VibratingLoaderIcon className="text-white" />
                    Creating game...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                      <path d="M8 5v14l11-7-11-7z" />
                    </svg>
                    Create game
                  </>
                )}
              </button>
              <span className="text-xs text-slate-500">
                Team: {selectedTeam?.name ?? "first available team"} · Human seats: {humanSlots} · AI seats: {aiPlayers}
              </span>
            </div>
          </form>

          {createError ? <InlineMessage kind="error">{createError}</InlineMessage> : null}
        </WoiSection>
      ) : null}

      {entryMode === "existing" ? (
        <WoiSection title="Find an existing game">
          <WoiLobbyScreen onLobbyCountChange={setLiveGameCount} />
        </WoiSection>
      ) : null}

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
