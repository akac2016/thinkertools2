"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { apiFetch, isApiRequestError } from "@/components/quipx/client";

type RoundPromptClaim = {
  label: string;
  text: string;
  displayText: string;
};

type ContradictionRound = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  difficultyLabel: string;
  xpReward: number;
  recommendedLevelMin: number;
  recommendedLevelMax: number;
  roundType: string;
  questionText: string;
  promptClaims: RoundPromptClaim[];
};

type ProgressState = {
  currentLevel: number;
  currentLevelXp: number;
  totalXp: number;
  xpRequiredForNextLevel: number;
  xpRemainingForNextLevel: number;
};

type SkillCatalogEntry = {
  id: string;
  slug: string;
  title: string;
  maxLevel: number;
  isActive: boolean;
};

type LoadRoundsResponse = {
  skill: {
    id: string;
    slug: string;
    title: string;
  };
  progress: ProgressState;
  skillCatalog: SkillCatalogEntry[];
  rounds: ContradictionRound[];
};

type SubmitRoundResponse = {
  result: {
    wasCorrect: boolean;
    selectedLabels: string[];
    correctAnswerLabels: string[];
    explanation: string;
    awardedXp: number;
    xpMultiplier: 1 | 0.5 | 0;
  };
  progress: ProgressState & {
    leveledUp: boolean;
  };
};

type RoundResult = SubmitRoundResponse["result"];

type ChatTone = "system" | "activity" | "action" | "alert" | "result" | "player";
type SkillPanelEntry = {
  key: string;
  title: string;
  status: string;
  isCurrent: boolean;
};

const PLANNED_SKILL_TITLES = [
  "AI Reasoning",
  "Scientific Reasoning",
  "Historical Reasoning",
  "Economic Reasoning",
] as const;
const CONTRADICTION_SPOTTING_DISPLAY_TITLE = "Contradiction Spotting" as const;

function formatDifficulty(label: string): string {
  if (!label.trim()) {
    return "Unrated";
  }

  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

function getProgressPercent(progress: ProgressState | null): number {
  if (!progress || progress.xpRequiredForNextLevel <= 0) {
    return 0;
  }

  const ratio = progress.currentLevelXp / progress.xpRequiredForNextLevel;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

function TypedMessage({
  text,
  runKey,
  enabled,
  onComplete,
  speedMs = 12,
}: {
  text: string;
  runKey: string;
  enabled: boolean;
  onComplete?: () => void;
  speedMs?: number;
}) {
  const [visibleCount, setVisibleCount] = useState(0);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | null = null;

    if (!enabled) {
      timerId = setTimeout(() => setVisibleCount(0), 0);
      return () => {
        if (timerId) {
          clearTimeout(timerId);
        }
      };
    }

    let cancelled = false;
    let completed = false;

    const tick = (currentCount: number) => {
      if (cancelled) {
        return;
      }

      const nextCount = Math.min(text.length, currentCount + 1);
      setVisibleCount(nextCount);

      if (nextCount < text.length) {
        timerId = setTimeout(() => tick(nextCount), speedMs);
      } else if (!completed) {
        completed = true;
        onCompleteRef.current?.();
      }
    };

    timerId = setTimeout(() => {
      setVisibleCount(0);
      tick(0);
    }, 0);

    return () => {
      cancelled = true;
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [enabled, runKey, speedMs, text]);

  const hasStarted = enabled;
  const isComplete = visibleCount >= text.length;

  return (
    <p>
      {hasStarted ? text.slice(0, visibleCount) : ""}
      {hasStarted && !isComplete ? <span className="ml-0.5 inline-block h-4 w-[1px] animate-pulse bg-slate-500 align-middle" /> : null}
    </p>
  );
}

function ChatRow({
  speaker,
  children,
  tone,
  side = "left",
}: {
  speaker: string;
  children: ReactNode;
  tone: ChatTone;
  side?: "left" | "right";
}) {
  const toneClasses: Record<ChatTone, string> = {
    system: "border-emerald-200 bg-white",
    activity: "border-teal-200 bg-teal-50/90",
    action: "border-lime-200 bg-lime-50/90",
    alert: "border-rose-200 bg-rose-50/95",
    result: "border-green-300 bg-green-50/70",
    player: "border-emerald-900 bg-emerald-950 text-emerald-50",
  };

  const bubbleClasses = side === "right"
    ? "ml-auto max-w-[88%]"
    : "mr-auto max-w-[92%]";

  return (
    <article className={`rounded-2xl border px-3 py-3 shadow-sm ${toneClasses[tone]} ${bubbleClasses}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${side === "right" ? "text-emerald-200" : "text-emerald-800"}`}>
        {speaker}
      </p>
      <div className={`mt-2 space-y-2 text-sm ${side === "right" ? "text-emerald-50" : "text-emerald-950"}`}>
        {children}
      </div>
    </article>
  );
}

function CharacterPanel({
  skillTitle,
  currentLevel,
  totalXp,
  activeRoundNumber,
  totalRounds,
}: {
  skillTitle: string;
  currentLevel: number | null;
  totalXp: number | null;
  activeRoundNumber: number;
  totalRounds: number;
}) {
  return (
    <aside className="h-fit rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700">Character</p>
      <p className="mt-1 text-sm font-semibold text-amber-950">ThinkerTools Player</p>
      <p className="mt-1 text-xs text-amber-900">Role: ThinkerTools Player</p>

      <div className="mt-3 space-y-2 rounded-md border border-emerald-200 bg-white/80 p-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-amber-700">Current Skill</span>
          <span className="font-medium text-amber-950">{skillTitle}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-amber-700">Level</span>
          <span className="font-medium text-amber-950">{currentLevel ?? "-"}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-amber-700">Total XP</span>
          <span className="font-medium text-amber-950">{totalXp ?? 0}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-amber-700">Mission Node</span>
          <span className="font-medium text-amber-950">{activeRoundNumber}/{totalRounds}</span>
        </div>
      </div>

      <p className="mt-3 text-xs text-amber-900">
        Status: In active drill sequence.
      </p>
    </aside>
  );
}

function SkillsPanel({ displayedSkills }: { displayedSkills: SkillPanelEntry[] }) {
  return (
    <aside className="h-fit rounded-2xl border border-cyan-200 bg-cyan-50 p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-700">Skills</p>
      <p className="mt-1 text-xs text-cyan-900">Player training tracks</p>

      <ul className="mt-3 space-y-2">
        {displayedSkills.map((skill) => (
          <li key={skill.key}>
            <div
              className={`rounded-md border px-2 py-1 text-xs ${
                skill.isCurrent
                  ? "border-emerald-800 bg-emerald-900 text-emerald-50"
                  : "border-emerald-200 bg-white/80 text-emerald-900"
              }`}
            >
              <p className="font-medium">{skill.title}</p>
              <p className={skill.isCurrent ? "text-emerald-200" : "text-emerald-700"}>{skill.status}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 rounded-md border border-dashed border-cyan-300 bg-white px-2 py-2 text-xs text-cyan-800">
        Additional Reasoning Skills Coming
      </div>
    </aside>
  );
}

export function ContradictionSpottingDrillClient() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSkillSlug, setActiveSkillSlug] = useState("philosophical-reasoning");
  const [skillTitle, setSkillTitle] = useState("Philosophical Reasoning");
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [skillCatalog, setSkillCatalog] = useState<SkillCatalogEntry[]>([]);
  const [rounds, setRounds] = useState<ContradictionRound[]>([]);
  const [activeRoundSlug, setActiveRoundSlug] = useState<string>("");
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [trainingSelection, setTrainingSelection] = useState<string | null>(null);
  const [onboardingStage, setOnboardingStage] = useState<"ask_name" | "welcome" | "ask_training" | "ready">("ask_name");
  const [recoverableInputError, setRecoverableInputError] = useState<string | null>(null);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [submittedTurnText, setSubmittedTurnText] = useState<string | null>(null);
  const [submissionPhase, setSubmissionPhase] = useState<"idle" | "player_sent" | "checking" | "done">("idle");
  const checkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeRound = useMemo(
    () => rounds.find((round) => round.slug === activeRoundSlug) ?? null,
    [activeRoundSlug, rounds],
  );

  const activeRoundNumber = useMemo(() => {
    if (!activeRound) {
      return 0;
    }

    return rounds.findIndex((round) => round.slug === activeRound.slug) + 1;
  }, [activeRound, rounds]);

  const displayedSkills = useMemo(() => {
    const entries: SkillPanelEntry[] = [];
    const catalogByTitle = new Map(
      skillCatalog.map((skill) => [skill.title.trim().toLowerCase(), skill]),
    );

    entries.push({
      key: activeSkillSlug,
      title: skillTitle,
      isCurrent: true,
      status: progress ? `Practicing • Lv ${progress.currentLevel}` : "Practicing",
    });

    for (const plannedTitle of PLANNED_SKILL_TITLES) {
      if (plannedTitle.trim().toLowerCase() === skillTitle.trim().toLowerCase()) {
        continue;
      }

      const configuredSkill = catalogByTitle.get(plannedTitle.trim().toLowerCase());

      entries.push({
        key: configuredSkill?.slug ?? `planned-${plannedTitle}`,
        title: configuredSkill?.title ?? plannedTitle,
        isCurrent: false,
        status: configuredSkill ? "Available" : "Planned",
      });
    }

    for (const configuredSkill of skillCatalog) {
      const alreadyIncluded = entries.some((entry) =>
        entry.title.trim().toLowerCase() === configuredSkill.title.trim().toLowerCase());
      if (alreadyIncluded) {
        continue;
      }

      entries.push({
        key: configuredSkill.slug,
        title: configuredSkill.title,
        isCurrent: configuredSkill.slug === activeSkillSlug,
        status: configuredSkill.slug === activeSkillSlug
          ? (progress ? `Practicing • Lv ${progress.currentLevel}` : "Practicing")
          : "Available",
      });
    }

    return entries;
  }, [activeSkillSlug, progress, skillCatalog, skillTitle]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiFetch<LoadRoundsResponse>("/api/thinkertoolsquest/contradiction-rounds");
        if (!mounted) {
          return;
        }

        setActiveSkillSlug(response.skill.slug);
        setSkillTitle(response.skill.title);
        setProgress(response.progress);
        setSkillCatalog(response.skillCatalog);
        setRounds(response.rounds);
        setActiveRoundSlug((currentSlug) => {
          if (currentSlug && response.rounds.some((round) => round.slug === currentSlug)) {
            return currentSlug;
          }

          return response.rounds[0]?.slug ?? "";
        });
      } catch (loadError) {
        if (!mounted) {
          return;
        }

        const message = isApiRequestError(loadError)
          ? loadError.message
          : "Failed to load contradiction rounds.";
        setError(message);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setSelectedLabels([]);
    setTypedAnswer("");
    setRoundResult(null);
    setRecoverableInputError(null);
    setSubmittedTurnText(null);
    setSubmissionPhase("idle");
    if (checkingTimerRef.current) {
      clearTimeout(checkingTimerRef.current);
      checkingTimerRef.current = null;
    }
  }, [activeRoundSlug]);

  const progressPercent = getProgressPercent(progress);
  const animationRoundKey = (activeRound?.slug ?? activeRoundSlug) || "round";
  const [scriptState, setScriptState] = useState<{ roundKey: string; progress: number }>({
    roundKey: "",
    progress: 0,
  });
  const [actionOptionsState, setActionOptionsState] = useState<{ roundKey: string; visibleCount: number }>({
    roundKey: "",
    visibleCount: 0,
  });
  const [roundReadinessState, setRoundReadinessState] = useState<{
    roundKey: string;
    acknowledged: boolean;
    playerMessage: string | null;
  }>({
    roundKey: "",
    acknowledged: false,
    playerMessage: null,
  });

  const scriptProgress = scriptState.roundKey === animationRoundKey
    ? scriptState.progress
    : 0;
  const visibleActionOptionCount = actionOptionsState.roundKey === animationRoundKey
    ? actionOptionsState.visibleCount
    : 0;
  const roundIsAcknowledged = roundReadinessState.roundKey === animationRoundKey
    && roundReadinessState.acknowledged;
  const roundReadinessReply = roundReadinessState.roundKey === animationRoundKey
    ? roundReadinessState.playerMessage
    : null;

  useEffect(() => {
    setScriptState((current) => {
      if (current.roundKey === animationRoundKey && current.progress === 0) {
        return current;
      }

      return {
        roundKey: animationRoundKey,
        progress: 0,
      };
    });
  }, [animationRoundKey]);

  useEffect(() => {
    setActionOptionsState((current) => {
      if (current.roundKey === animationRoundKey && current.visibleCount === 0) {
        return current;
      }

      return {
        roundKey: animationRoundKey,
        visibleCount: 0,
      };
    });
  }, [animationRoundKey]);

  useEffect(() => {
    setRoundReadinessState((current) => {
      if (current.roundKey === animationRoundKey && !current.acknowledged && !current.playerMessage) {
        return current;
      }

      return {
        roundKey: animationRoundKey,
        acknowledged: false,
        playerMessage: null,
      };
    });
  }, [animationRoundKey]);

  const scriptedMessages = useMemo(() => {
    if (!activeRound) {
      return [];
    }

    return [
      {
        id: "system-status",
        speaker: "System",
        tone: "system" as const,
        text: `Player status confirmed. You are in an active ${skillTitle} drill.`,
        speedMs: 12,
      },
      {
        id: "system-objective",
        speaker: "System",
        tone: "system" as const,
        text: "Identify one pair of claims that cannot both be true.",
        speedMs: 12,
      },
    ];
  }, [activeRound, skillTitle]);

  const introComplete = Boolean(activeRound) && scriptProgress >= scriptedMessages.length;
  const onboardingReady = onboardingStage === "ready" && Boolean(playerName) && Boolean(trainingSelection);
  const shouldPromptRoundCheckIn = onboardingReady && Boolean(activeRound) && introComplete && !roundIsAcknowledged && !roundResult;
  const canShowRoundQuestion = onboardingReady && Boolean(activeRound) && introComplete && roundIsAcknowledged;
  const areAllActionOptionsVisible = !activeRound
    || visibleActionOptionCount >= activeRound.promptClaims.length;

  useEffect(() => {
    if (!activeRound || !introComplete) {
      return;
    }

    const totalOptions = activeRound.promptClaims.length;
    if (totalOptions === 0) {
      return;
    }

    let revealedCount = 0;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    const initialRevealDelayMs = 320;
    const perOptionRevealDelayMs = 360;

    const revealNextOption = () => {
      revealedCount += 1;

      setActionOptionsState((current) => {
        const nextVisibleCount = Math.min(revealedCount, totalOptions);

        if (current.roundKey !== animationRoundKey) {
          return {
            roundKey: animationRoundKey,
            visibleCount: nextVisibleCount,
          };
        }

        if (current.visibleCount >= nextVisibleCount) {
          return current;
        }

        return {
          ...current,
          visibleCount: nextVisibleCount,
        };
      });

      if (revealedCount < totalOptions) {
        timerId = setTimeout(revealNextOption, perOptionRevealDelayMs);
      }
    };

    timerId = setTimeout(revealNextOption, initialRevealDelayMs);

    return () => {
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [activeRound, animationRoundKey, introComplete]);

  const goToRoundByOffset = (offset: number) => {
    if (!activeRound || rounds.length === 0) {
      return;
    }

    const activeIndex = rounds.findIndex((round) => round.slug === activeRound.slug);
    const nextIndex = (activeIndex + offset + rounds.length) % rounds.length;
    setActiveRoundSlug(rounds[nextIndex].slug);
  };

  const onToggleClaimLabel = (label: string) => {
    if (roundResult) {
      return;
    }

    setRecoverableInputError(null);

    setSelectedLabels((current) => {
      if (current.includes(label)) {
        return current.filter((item) => item !== label);
      }

      if (current.length < 2) {
        return [...current, label];
      }

      return [current[1], label];
    });
  };

  const onReplay = () => {
    setSelectedLabels([]);
    setTypedAnswer("");
    setRoundResult(null);
    setRecoverableInputError(null);
    setSubmittedTurnText(null);
    setSubmissionPhase("idle");
    if (checkingTimerRef.current) {
      clearTimeout(checkingTimerRef.current);
      checkingTimerRef.current = null;
    }
  };

  const onGoToNextRound = () => {
    goToRoundByOffset(1);
  };

  const onSelectTrainingSkill = (selection: string) => {
    setTrainingSelection(selection);
    setTypedAnswer("");
    setRecoverableInputError(null);
    setOnboardingStage("ready");
  };

  const onSubmit = async () => {
    const incomingText = typedAnswer.trim();

    if (!playerName) {
      if (!incomingText) {
        setRecoverableInputError("Please enter your name to start.");
        return;
      }

      setPlayerName(incomingText);
      setTrainingSelection(null);
      setOnboardingStage("welcome");
      setTypedAnswer("");
      setRecoverableInputError(null);
      return;
    }

    if (onboardingStage === "ask_training") {
      if (!incomingText) {
        setRecoverableInputError("Type Philosophical Reasoning to continue.");
        return;
      }

      const normalizedIncoming = incomingText.toLowerCase();
      const normalizedSkillTitle = skillTitle.toLowerCase();
      const selectedPhilosophical = normalizedIncoming === normalizedSkillTitle
        || normalizedIncoming.includes("philosophical reasoning")
        || normalizedIncoming.includes("philosophical");

      if (!selectedPhilosophical) {
        setRecoverableInputError("Available right now: Philosophical Reasoning.");
        return;
      }

      onSelectTrainingSkill(skillTitle);
      return;
    }

    if (!activeRound || roundResult) {
      return;
    }

    if (shouldPromptRoundCheckIn) {
      if (!incomingText) {
        setRecoverableInputError("Type a short reply to continue.");
        return;
      }

      setRoundReadinessState({
        roundKey: animationRoundKey,
        acknowledged: true,
        playerMessage: incomingText,
      });
      setTypedAnswer("");
      setRecoverableInputError(null);
      return;
    }

    const submitStartedAt = Date.now();
    const submittedText = incomingText
      ? incomingText
      : (selectedLabels.length > 0 ? selectedLabels.join(" + ") : "No pair selected");

    setSubmittedTurnText(submittedText);
    setSubmissionPhase("player_sent");
    setSubmitting(true);
    setError(null);
    setRecoverableInputError(null);
    if (checkingTimerRef.current) {
      clearTimeout(checkingTimerRef.current);
      checkingTimerRef.current = null;
    }
    checkingTimerRef.current = setTimeout(() => {
      setSubmissionPhase((current) => (current === "player_sent" ? "checking" : current));
    }, 220);

    try {
      const response = await apiFetch<SubmitRoundResponse>("/api/thinkertoolsquest/contradiction-rounds/submit", {
        method: "POST",
        body: JSON.stringify({
          activitySlug: activeRound.slug,
          selectedLabels,
          typedAnswer: incomingText,
        }),
      });

      const elapsedMs = Date.now() - submitStartedAt;
      const minimumTurnMs = 260;
      if (elapsedMs < minimumTurnMs) {
        await new Promise((resolve) => setTimeout(resolve, minimumTurnMs - elapsedMs));
      }

      setRoundResult(response.result);
      setProgress(response.progress);
      setSelectedLabels(response.result.selectedLabels);
      setSubmissionPhase("done");
    } catch (submitError) {
      const elapsedMs = Date.now() - submitStartedAt;
      const minimumTurnMs = 260;
      if (elapsedMs < minimumTurnMs) {
        await new Promise((resolve) => setTimeout(resolve, minimumTurnMs - elapsedMs));
      }

      if (isApiRequestError(submitError)) {
        const isRecoverable = submitError.status === 422
          && submitError.code?.startsWith("QUESTS_");

        if (isRecoverable) {
          setRecoverableInputError(submitError.message);
        } else {
          setError(submitError.message);
        }
      } else {
        setError("Failed to submit answer.");
      }
      setSubmissionPhase("done");
    } finally {
      if (checkingTimerRef.current) {
        clearTimeout(checkingTimerRef.current);
        checkingTimerRef.current = null;
      }
      setSubmitting(false);
    }
  };

  const isBooting = loading && rounds.length === 0;
  const hasStartupError = Boolean(error) && rounds.length === 0;
  const hasNoRounds = !loading && !activeRound;
  const isAwaitingName = !isBooting && !hasStartupError && onboardingStage === "ask_name";
  const isWelcomingPlayer = !isBooting && !hasStartupError && onboardingStage === "welcome";
  const isAwaitingTrainingChoice = !isBooting && !hasStartupError && onboardingStage === "ask_training";
  const canInteractWithRound = !isBooting
    && !hasStartupError
    && onboardingReady
    && Boolean(activeRound)
    && canShowRoundQuestion
    && areAllActionOptionsVisible
    && !roundResult;
  const isComposerDisabled = submitting || !(isAwaitingName || isAwaitingTrainingChoice || shouldPromptRoundCheckIn || canInteractWithRound);
  const composerHint = isBooting
    ? "Booting terminal..."
    : hasStartupError
      ? "Input unavailable while startup error is active."
      : hasNoRounds
        ? "No active node to respond to."
        : isAwaitingName
          ? "Start by telling the system your name."
          : isWelcomingPlayer
            ? "Stand by while the system initializes your drill feed."
          : isAwaitingTrainingChoice
            ? "Choose your training focus to begin."
          : shouldPromptRoundCheckIn
            ? "Reply once to continue into this question."
        : !introComplete
          ? "Wait for the prompt to finish."
          : !areAllActionOptionsVisible
            ? "Wait for all options to finish loading."
            : roundResult
              ? "Round finished. Retry or continue to unlock input."
              : `Locked pair: ${selectedLabels.length > 0 ? selectedLabels.join(" + ") : "None"}`;

  return (
    <div className="mx-auto w-full max-w-6xl bg-gradient-to-b from-stone-50 to-emerald-50 px-4 py-6 sm:px-6">
      <header className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-300 bg-white px-3 py-2 text-xs shadow-sm sm:px-4">
        <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-900">
          ThinkerTools Quests
        </span>
        <span className="text-emerald-800">Player Shell</span>
        <span className="text-emerald-800">Total XP: {progress?.totalXp ?? 0}</span>
        <span className="text-emerald-800">Practicing: {skillTitle}</span>
        <span className="text-emerald-800">Node {activeRoundNumber}/{rounds.length}</span>

        <div className="ml-auto flex min-w-[180px] items-center gap-2">
          <span className="text-emerald-800">Level XP</span>
          <div className="h-1.5 flex-1 rounded-full bg-emerald-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-500 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-emerald-800">
            {progress ? `${progress.currentLevelXp}/${progress.xpRequiredForNextLevel || 0}` : "-"}
          </span>
        </div>
      </header>

      <div className="mb-4 xl:hidden">
        <CharacterPanel
          skillTitle={skillTitle}
          currentLevel={progress?.currentLevel ?? null}
          totalXp={progress?.totalXp ?? null}
          activeRoundNumber={activeRoundNumber}
          totalRounds={rounds.length}
        />
      </div>

      <div className="relative">
        <div className="hidden xl:absolute xl:right-full xl:mr-4 xl:block xl:w-[220px]">
          <CharacterPanel
            skillTitle={skillTitle}
            currentLevel={progress?.currentLevel ?? null}
            totalXp={progress?.totalXp ?? null}
            activeRoundNumber={activeRoundNumber}
            totalRounds={rounds.length}
          />
        </div>

        <div className="hidden xl:absolute xl:left-full xl:ml-4 xl:block xl:w-[280px]">
          <SkillsPanel displayedSkills={displayedSkills} />
        </div>

        <section className="overflow-hidden rounded-2xl border border-emerald-300 bg-white shadow-sm">
          <main className="bg-stone-50 px-3 py-4 sm:px-4 sm:py-5">
            <div className="flex min-h-[560px] flex-col gap-3">
              <div className="min-h-[420px] rounded-xl border border-emerald-200 bg-white p-2 sm:p-3">
                <div className="space-y-3">
                  {isBooting ? (
                    <ChatRow tone="system" speaker="System" side="left">
                      <p>Booting ThinkerTools Quest terminal...</p>
                    </ChatRow>
                  ) : null}

                  {!isBooting && hasStartupError ? (
                    <ChatRow tone="alert" speaker="System" side="left">
                      <p className="text-rose-700">{error}</p>
                    </ChatRow>
                  ) : null}

                  {!isBooting && !hasStartupError && hasNoRounds ? (
                    <ChatRow tone="system" speaker="System" side="left">
                      <p>No Contradiction Spotting rounds are available yet.</p>
                    </ChatRow>
                  ) : null}

                  {!isBooting && !hasStartupError && isAwaitingName ? (
                    <>
                      <ChatRow tone="system" speaker="System" side="left">
                        <p>I am the ThinkerTools System Guide.</p>
                      </ChatRow>

                      <ChatRow tone="system" speaker="System" side="left">
                        <p>Before we begin the Philosophical Reasoning drills, what should I call you?</p>
                      </ChatRow>
                    </>
                  ) : null}

                  {!isBooting && !hasStartupError && playerName && !isAwaitingName ? (
                    <>
                      <ChatRow tone="player" speaker="Player" side="right">
                        <p>{playerName}</p>
                      </ChatRow>

                      {isWelcomingPlayer ? (
                        <ChatRow tone="system" speaker="System" side="left">
                          <TypedMessage
                            text={`Welcome, ${playerName}. Initializing your drill feed.`}
                            runKey={`welcome-${playerName}`}
                            enabled
                            speedMs={13}
                            onComplete={() => {
                              setOnboardingStage((current) => (current === "welcome" ? "ask_training" : current));
                            }}
                          />
                        </ChatRow>
                      ) : (
                        <ChatRow tone="system" speaker="System" side="left">
                          <p>Welcome, {playerName}. Initializing your drill feed.</p>
                        </ChatRow>
                      )}
                    </>
                  ) : null}

                  {!isBooting && !hasStartupError && isAwaitingTrainingChoice ? (
                    <>
                      <ChatRow tone="system" speaker="System" side="left">
                        <p>What skill do you want to train right now?</p>
                        <p className="text-xs text-emerald-800">Available now: Philosophical Reasoning.</p>
                      </ChatRow>
                      <ChatRow tone="player" speaker="Player" side="right">
                        <button
                          type="button"
                          onClick={() => onSelectTrainingSkill(skillTitle)}
                          className="rounded-md border border-emerald-300 bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-200"
                        >
                          Train Philosophical Reasoning
                        </button>
                      </ChatRow>
                    </>
                  ) : null}

                  {onboardingReady && trainingSelection ? (
                    <>
                      <ChatRow tone="player" speaker="Player" side="right">
                        <p>I want to train {trainingSelection}.</p>
                      </ChatRow>
                      <ChatRow tone="system" speaker="System" side="left">
                        <p>Training track confirmed: {trainingSelection}.</p>
                      </ChatRow>
                    </>
                  ) : null}

                  {!isBooting && !hasStartupError && activeRound && onboardingReady ? (
                    <>
                      <div className="space-y-2">
                        {scriptedMessages.map((message, index) => {
                          const shouldRender = index === 0 || scriptProgress >= index;
                          if (!shouldRender) {
                            return null;
                          }

                          return (
                            <ChatRow
                              key={`${animationRoundKey}-${message.id}`}
                              speaker={message.speaker}
                              tone={message.tone}
                              side="left"
                            >
                              <TypedMessage
                                text={message.text}
                                runKey={`${animationRoundKey}-${message.id}`}
                                enabled
                                speedMs={message.speedMs}
                                onComplete={() => {
                                  setScriptState((current) => {
                                    if (current.roundKey !== animationRoundKey) {
                                      return {
                                        roundKey: animationRoundKey,
                                        progress: index + 1,
                                      };
                                    }

                                    return current.progress < index + 1
                                      ? { ...current, progress: index + 1 }
                                      : current;
                                  });
                                }}
                              />
                            </ChatRow>
                          );
                        })}
                      </div>

                      {shouldPromptRoundCheckIn ? (
                        <ChatRow tone="system" speaker="System" side="left">
                          <p>Reply when you are ready, and I will open the next question.</p>
                        </ChatRow>
                      ) : null}

                      {roundReadinessReply ? (
                        <ChatRow tone="player" speaker="Player" side="right">
                          <p>{roundReadinessReply}</p>
                        </ChatRow>
                      ) : null}

                      {canShowRoundQuestion ? (
                        <ChatRow tone="system" speaker="System" side="left">
                          <TypedMessage
                            text={`${CONTRADICTION_SPOTTING_DISPLAY_TITLE}: ${activeRound.questionText}`}
                            runKey={`${animationRoundKey}-question`}
                            enabled
                            speedMs={11}
                          />
                        </ChatRow>
                      ) : null}

                      {canShowRoundQuestion ? (
                        <ChatRow tone="system" speaker="System" side="left">
                          <p>Select two options, then confirm your pair.</p>
                          <p className="text-xs text-emerald-800">{activeRound.shortDescription}</p>
                          <p className="text-xs text-emerald-800">
                            Reward on success: +{activeRound.xpReward} XP • Suggested level: {activeRound.recommendedLevelMin}-{activeRound.recommendedLevelMax} • {formatDifficulty(activeRound.difficultyLabel)}
                          </p>

                          <div className="mt-2 grid gap-2">
                            {activeRound.promptClaims.slice(0, visibleActionOptionCount).map((claim) => {
                              const isSelected = selectedLabels.includes(claim.label);
                              const isCorrectLabel = roundResult?.correctAnswerLabels.includes(claim.label) ?? false;
                              const isWrongSelected = Boolean(roundResult) && isSelected && !isCorrectLabel;

                              const statusClass = roundResult
                                ? isCorrectLabel
                                  ? "border-emerald-400 bg-emerald-50"
                                  : isWrongSelected
                                    ? "border-rose-300 bg-rose-50"
                                    : "border-emerald-200 bg-white/95"
                                : isSelected
                                  ? "border-emerald-500 bg-emerald-100"
                                  : "border-emerald-200 bg-white/95 hover:border-emerald-300";

                              return (
                                <button
                                  key={claim.label}
                                  type="button"
                                  onClick={() => onToggleClaimLabel(claim.label)}
                                  disabled={Boolean(roundResult)}
                                  className={`rounded-lg border px-3 py-2 text-left transition ${statusClass} ${
                                    roundResult ? "cursor-default" : ""
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">Option {claim.label}</p>
                                    {isSelected ? (
                                      <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-800">
                                        selected
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="mt-1 text-sm font-medium text-emerald-950">{claim.displayText}</p>
                                </button>
                              );
                            })}
                          </div>

                          {!areAllActionOptionsVisible ? (
                            <p className="mt-2 text-xs text-emerald-700">Loading options...</p>
                          ) : (
                            <p className="mt-2 text-xs text-emerald-700">
                              Use the persistent chat input below to submit your pair.
                            </p>
                          )}
                        </ChatRow>
                      ) : null}

                      {submittedTurnText ? (
                        <ChatRow tone="player" speaker="Player" side="right">
                          <p>{submittedTurnText}</p>
                        </ChatRow>
                      ) : null}

                      {submitting && submissionPhase === "checking" ? (
                        <ChatRow tone="system" speaker="System" side="left">
                          <p>Checking selected pair...</p>
                        </ChatRow>
                      ) : null}

                      {error ? (
                        <ChatRow tone="alert" speaker="System" side="left">
                          <p className="text-rose-700">{error}</p>
                        </ChatRow>
                      ) : null}

                      {roundResult ? (
                        <ChatRow tone="result" speaker="System" side="left">
                          <p className={`text-base font-semibold ${roundResult.wasCorrect ? "text-emerald-800" : "text-rose-700"}`}>
                            {roundResult.wasCorrect ? "Result: Correct pair identified." : "Result: Selected pair was not correct."}
                          </p>
                          <p>Correct pair: {roundResult.correctAnswerLabels.join(" + ")}</p>
                          <p>Reasoning note: {roundResult.explanation}</p>
                          <p className="font-semibold text-emerald-950">XP gained: +{roundResult.awardedXp}</p>
                          {progress ? (
                            <p className="text-sm text-emerald-900">
                              Level {progress.currentLevel} • {progress.currentLevelXp}/{progress.xpRequiredForNextLevel || 0} XP in level • Total {progress.totalXp} XP
                            </p>
                          ) : null}

                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              type="button"
                              onClick={onReplay}
                              className="rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-sm text-emerald-900 hover:bg-emerald-50"
                            >
                              Retry This Node
                            </button>
                            <button
                              type="button"
                              onClick={onGoToNextRound}
                              className="rounded-md bg-emerald-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
                            >
                              Continue Forward
                            </button>
                          </div>
                        </ChatRow>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl border border-slate-300 bg-slate-50 p-3 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-700">Chat Input</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={typedAnswer}
                    onChange={(event) => {
                      setTypedAnswer(event.target.value);
                      setRecoverableInputError(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !isComposerDisabled) {
                        event.preventDefault();
                        void onSubmit();
                      }
                    }}
                    disabled={isComposerDisabled}
                    placeholder={
                      isAwaitingName
                        ? "Enter your name"
                        : isWelcomingPlayer
                          ? "Initializing..."
                        : isAwaitingTrainingChoice
                          ? "Type Philosophical Reasoning"
                        : shouldPromptRoundCheckIn
                          ? "Type a quick reply (e.g. ready)"
                          : canInteractWithRound
                            ? "A and C"
                            : "Awaiting available action..."
                    }
                    className="w-full rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm text-emerald-950 placeholder:text-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-50 disabled:text-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={onSubmit}
                    disabled={isComposerDisabled}
                    className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-300"
                  >
                    {submitting ? "Checking..." : "Submit"}
                  </button>
                </div>

                <p className="mt-2 text-xs text-emerald-800">{composerHint}</p>
                {recoverableInputError ? (
                  <p className="mt-2 text-sm text-amber-700">{recoverableInputError}</p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-emerald-200 pt-3">
                  <span className="text-xs text-emerald-700">Skip question:</span>
                  <button
                    type="button"
                    onClick={() => goToRoundByOffset(-1)}
                    disabled={submitting || !activeRound}
                    className="rounded-md border border-emerald-300 bg-white px-2.5 py-1.5 text-xs text-emerald-900 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={onGoToNextRound}
                    disabled={submitting || !activeRound}
                    className="rounded-md border border-emerald-300 bg-white px-2.5 py-1.5 text-xs text-emerald-900 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </main>
        </section>
      </div>

      <div className="mt-4 xl:hidden">
        <SkillsPanel displayedSkills={displayedSkills} />
      </div>
    </div>
  );
}
