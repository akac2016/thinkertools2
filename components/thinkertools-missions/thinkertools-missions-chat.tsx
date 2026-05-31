"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { apiFetch, isApiRequestError } from "@/components/quipx/client";
import { KanePlayerButton } from "@/components/kane-player/kane-player-button";
import {
  type MissionAction,
  type MissionCharacterClaim,
  type MissionDefinition,
  type MissionFact,
  type MissionResolutionOption,
} from "@/lib/missions";
import {
  isMatchingLabelPair,
  matchConstrainedTypedInput,
  normalizeLabelSelection,
} from "@/lib/quests";

import styles from "./thinkertools-missions-chat.module.css";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  name: string;
  body: string;
  missionActionSet?: MissionActionSet;
  missionFactDigest?: MissionFactDigest;
  missionResolutionSet?: MissionResolutionSet;
  missionStartPrompt?: MissionStartPrompt;
  missionStatementSet?: MissionStatementSet;
  trainingRound?: TrainingRoundTranscript;
  questionBank?: boolean;
};

type ChatMode = "feed" | "quest" | "activity";
type QuestStage = "none" | string;

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
  expectedAnswerCount: 1 | 2;
};

type ProgressState = {
  currentLevel: number;
  currentLevelXp: number;
  totalXp: number;
  xpRequiredForNextLevel: number;
  xpRemainingForNextLevel: number;
};

type LoadContradictionResponse = {
  training: {
    id: string;
    slug: string;
    title: string;
  };
  progress: ProgressState;
  rounds: ContradictionRound[];
  completedRoundSlugs: string[];
};

type SubmitContradictionResponse = {
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

type MissionCompletionState = {
  isCompleted: boolean;
  completedAt: string | null;
  awardedXp: number;
  replayCount: number;
  canReplay: boolean;
};

type LoadMissionsResponse = {
  progress: ProgressState;
  missions: Array<{
    id: string;
    slug: string;
    title: string;
    xpReward: number;
    isActive: boolean;
    isCompleted: boolean;
    completedAt: string | null;
    awardedXp: number;
    replayCount: number;
    canReplay: boolean;
  }>;
};

type LoadMissionDefinitionResponse = {
  definition: MissionDefinition;
};

type CompleteMissionResponse = {
  mission: {
    id: string;
    slug: string;
    title: string;
    xpReward: number;
  };
  completion: MissionCompletionState & {
    awardedXp: number;
    firstAwardedXp: number;
    replayed: boolean;
  };
  progress: ProgressState & {
    leveledUp: boolean;
  };
  nextRecommendedActivitySlug: string;
};

type TrainingRoundTranscript = {
  interactionId: string;
  round: ContradictionRound;
  selectedLabels: string[];
  incorrectAttempts: number;
  result: SubmitContradictionResponse["result"] | null;
};

type Mission = {
  id: string;
  title: string;
  status: "Available" | "Locked";
  requirements: string[];
  revealedFacts: string[];
  definition?: MissionDefinition;
};

type MissionActionSet = {
  missionId: string;
  stageId: string;
  stageTitle: string;
  actions: MissionAction[];
};

type MissionStartPrompt = {
  missionId: string;
  title: string;
  status: Mission["status"];
  requirements: string[];
};

type MissionFactDigest = {
  title: string;
  facts: MissionFact[];
};

type MissionStatementSet = {
  title: string;
  claims: MissionCharacterClaim[];
  detail: "role" | "statement";
};

type MissionResolutionSet = {
  title: string;
  options: MissionResolutionOption[];
};

type MissionContradictionResult = {
  wasCorrect: boolean;
  selectedLabels: string[];
  correctAnswerLabels: string[];
  explanation: string;
};

type MissionResolutionResult = {
  wasCorrect: boolean;
  selectedOptionId: string;
  selectedOptionLabel: string;
  bestOptionId: string;
  explanation: string;
};

type SkillActivity = {
  id: string;
  level: number;
  name: string;
  xp: number;
  status: "Unlocked" | "Locked";
  requirements: string[];
};

type Skill = {
  id: string;
  name: string;
  level: number;
  xp: number;
  activities: SkillActivity[];
};

const openingMessages: ChatMessage[] = [
  {
    id: "m-1",
    role: "assistant",
    name: "Mission Guide",
    body: "Welcome back. I can help you choose a mission, unpack the situation, or test one piece of reasoning before you move on.",
  },
  {
    id: "m-2",
    role: "assistant",
    name: "Mission Guide",
    body: "The current queue has one short reasoning mission ready. When you are ready, tell me what kind of challenge you want.",
  },
];

const CONTRADICTION_SPOTTING_SKILL_ID = "philosophical-thinking" as const;
const AVAILABLE_ACTIVITY_IDS = new Set(["contradiction-spotting"]);
const CONTRADICTION_SPOTTING_DISPLAY_TITLE = "Contradiction Spotting" as const;

const WRONG_RECRUIT_SLUG = "wrong-recruit" as const;

const placeholderMissions: Mission[] = [
  {
    id: WRONG_RECRUIT_SLUG,
    title: "The Wrong Recruit",
    status: "Available",
    requirements: ["Philosophical Reasoning level 1"],
    revealedFacts: [],
    definition: undefined,
  },
  {
    id: "missing-premise",
    title: "Missing Premise",
    status: "Locked",
    requirements: ["Complete the first mission intake", "Reveal one player profile field"],
    revealedFacts: [
      "This mission appears to involve a flawed argument.",
      "The supporting evidence has not been unlocked.",
    ],
  },
];

const skills: Skill[] = [
  {
    id: "philosophical-thinking",
    name: "Philosophical Thinking",
    level: 1,
    xp: 40,
    activities: [
      {
        id: "contradiction-spotting",
        level: 1,
        name: "Contradiction Spotting",
        xp: 20,
        status: "Unlocked",
        requirements: ["Philosophical Thinking level 1"],
      },
      {
        id: "explain-conflict",
        level: 2,
        name: "Explain why two claims cannot both hold",
        xp: 45,
        status: "Locked",
        requirements: ["Reach Contradiction Spotting level 2"],
      },
      {
        id: "missing-context",
        level: 3,
        name: "Resolve a contradiction under missing context",
        xp: 80,
        status: "Locked",
        requirements: ["Reach Contradiction Spotting level 3"],
      },
    ],
  },
  {
    id: "premise-testing",
    name: "Premise Testing",
    level: 1,
    xp: 0,
    activities: [
      {
        id: "unstated-assumption",
        level: 1,
        name: "Identify an unstated assumption",
        xp: 25,
        status: "Unlocked",
        requirements: ["Premise Testing level 1"],
      },
      {
        id: "rank-premises",
        level: 2,
        name: "Rank premises by evidential strength",
        xp: 55,
        status: "Locked",
        requirements: ["Reach Premise Testing level 2"],
      },
      {
        id: "revise-argument",
        level: 3,
        name: "Revise a weak argument without changing its conclusion",
        xp: 90,
        status: "Locked",
        requirements: ["Reach Premise Testing level 3"],
      },
    ],
  },
];

function getAssistantMessageDelay(message: ChatMessage) {
  const baseDelayMs = 380;
  const perCharacterDelayMs = 14;
  const maxDelayMs = 2400;

  return Math.min(maxDelayMs, baseDelayMs + message.body.length * perCharacterDelayMs);
}

export function ThinkertoolsMissionsChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [assistantQueue, setAssistantQueue] = useState<ChatMessage[]>(openingMessages);
  const [draft, setDraft] = useState("");
  const [currentMode, setCurrentMode] = useState<ChatMode>("feed");
  const [currentQuestStage, setCurrentQuestStage] = useState<QuestStage>("none");
  const [currentChatScript, setCurrentChatScript] = useState("feed-intro");
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [missions, setMissions] = useState<Mission[]>(placeholderMissions);
  const [revealedMissionFactIds, setRevealedMissionFactIds] = useState<Set<string>>(() => new Set());
  const [selectedMissionClaimLabels, setSelectedMissionClaimLabels] = useState<string[]>([]);
  const [missionContradictionResult, setMissionContradictionResult] = useState<MissionContradictionResult | null>(null);
  const [selectedMissionResolutionId, setSelectedMissionResolutionId] = useState("");
  const [missionResolutionResult, setMissionResolutionResult] = useState<MissionResolutionResult | null>(null);
  const [missionInputError, setMissionInputError] = useState<string | null>(null);
  const [missionCompleted, setMissionCompleted] = useState(false);
  const [missionCompletions, setMissionCompletions] = useState<Record<string, MissionCompletionState>>({});
  const [missionProgressLoaded, setMissionProgressLoaded] = useState(false);
  const [missionCompletionLoading, setMissionCompletionLoading] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<SkillActivity | null>(null);
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [initialTrainingProgressLoaded, setInitialTrainingProgressLoaded] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState<ProgressState | null>(null);
  const [contradictionRounds, setContradictionRounds] = useState<ContradictionRound[]>([]);
  const [activeRoundSlug, setActiveRoundSlug] = useState("");
  const [activeTrainingInteractionId, setActiveTrainingInteractionId] = useState<string | null>(null);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [roundResult, setRoundResult] = useState<SubmitContradictionResponse["result"] | null>(null);
  const [completedRoundSlugs, setCompletedRoundSlugs] = useState<Set<string>>(() => new Set());
  const [submittingTraining, setSubmittingTraining] = useState(false);
  const messageIdCounter = useRef(0);
  const messageStackRef = useRef<HTMLDivElement | null>(null);

  // Refreshes training progress and mission completion state from the server.
  // Called by KanePlayerButton after each step so the UI stays in sync with
  // what Kane is doing in the browser.
  const refreshProgress = useCallback(async () => {
    try {
      const [missionsResponse, trainingResponse] = await Promise.all([
        apiFetch<LoadMissionsResponse>("/api/thinkertools-missions/missions"),
        apiFetch<LoadContradictionResponse>("/api/thinkertools-missions/training/contradiction-spotting"),
      ]);

      setTrainingProgress(trainingResponse.progress);
      setContradictionRounds(trainingResponse.rounds);
      setCompletedRoundSlugs(new Set(trainingResponse.completedRoundSlugs));

      setMissionCompletions(Object.fromEntries(
        missionsResponse.missions.map((mission) => [
          mission.slug,
          {
            isCompleted: mission.isCompleted,
            completedAt: mission.completedAt,
            awardedXp: mission.awardedXp,
            replayCount: mission.replayCount,
            canReplay: mission.canReplay,
          },
        ]),
      ));

      setMissions((current) => {
        const updated = current.map((m) => {
          const dbMission = missionsResponse.missions.find((r) => r.slug === m.id);
          if (!dbMission) return m;
          return {
            ...m,
            id: dbMission.slug,
            title: dbMission.title,
            status: dbMission.isActive ? ("Available" as const) : ("Locked" as const),
          };
        });
        return updated;
      });
    } catch {
      // Silently ignore refresh errors — Kane is still running
    }
  }, []);

  const activeRound = useMemo(
    () => contradictionRounds.find((round) => round.slug === activeRoundSlug) ?? null,
    [activeRoundSlug, contradictionRounds],
  );
  const selectedMissionDefinition = selectedMission?.definition ?? null;
  const activeMissionStage = useMemo(() => {
    if (!selectedMissionDefinition || currentMode !== "quest" || currentQuestStage === "none") {
      return null;
    }

    return selectedMissionDefinition.stages.find((stage) => stage.id === currentQuestStage) ?? null;
  }, [currentMode, currentQuestStage, selectedMissionDefinition]);
  const revealedMissionFacts = useMemo(() => {
    if (!selectedMissionDefinition) {
      return [];
    }

    return selectedMissionDefinition.facts.filter((fact) => revealedMissionFactIds.has(fact.id));
  }, [revealedMissionFactIds, selectedMissionDefinition]);
  const selectedMissionCompletion = selectedMissionDefinition
    ? missionCompletions[selectedMissionDefinition.slug] ?? null
    : null;
  const activeRoundIndex = useMemo(
    () => contradictionRounds.findIndex((round) => round.slug === activeRoundSlug),
    [activeRoundSlug, contradictionRounds],
  );
  const activeRoundNumber = activeRoundIndex >= 0 ? activeRoundIndex + 1 : 0;
  const isTrainingRoundActive = currentMode === "activity" && Boolean(activeRound) && !roundResult;
  const isMissionContradictionActive = currentMode === "quest"
    && activeMissionStage?.id === "contradiction-review"
    && missionContradictionResult?.wasCorrect !== true;
  const isMissionResolutionActive = currentMode === "quest"
    && activeMissionStage?.id === "resolution-choice"
    && missionResolutionResult?.wasCorrect !== true;
  const shouldShowQuestionBankButton = currentMode === "activity"
    && Boolean(activeRound)
    && contradictionRounds.length > 0;
  const activeTrainingSkillId = selectedActivity ? selectedSkill?.id ?? null : null;
  const canSend = isTrainingRoundActive
    ? draft.trim().length > 0 || selectedLabels.length === (activeRound?.expectedAnswerCount ?? 2)
    : isMissionContradictionActive
      ? draft.trim().length > 0 || selectedMissionClaimLabels.length === 2
      : isMissionResolutionActive
        ? draft.trim().length > 0 || Boolean(selectedMissionResolutionId)
        : draft.trim().length > 0;
  const messageCountLabel = useMemo(
    () => `${messages.length} message${messages.length === 1 ? "" : "s"}`,
    [messages.length],
  );

  function getMessageId(prefix: string) {
    messageIdCounter.current += 1;
    return `${prefix}-${messageIdCounter.current}`;
  }

  function getSkillProgressDisplay(skill: Skill) {
    if (skill.id === CONTRADICTION_SPOTTING_SKILL_ID) {
      if (!initialTrainingProgressLoaded) {
        return {
          level: null,
          xp: null,
          levelXp: null,
          xpRequiredForNextLevel: null,
          status: "loading" as const,
        };
      }

      if (!trainingProgress) {
        return {
          level: null,
          xp: null,
          levelXp: null,
          xpRequiredForNextLevel: null,
          status: "unavailable" as const,
        };
      }

      return {
        level: trainingProgress.currentLevel,
        xp: trainingProgress.totalXp,
        levelXp: trainingProgress.currentLevelXp,
        xpRequiredForNextLevel: trainingProgress.xpRequiredForNextLevel,
        status: activeTrainingSkillId === skill.id ? "active" as const : "loaded" as const,
      };
    }

    return {
      level: skill.level,
      xp: skill.xp,
      levelXp: null,
      xpRequiredForNextLevel: null,
      status: "static" as const,
    };
  }

  function getSkillLevel(skill: Skill) {
    if (
      skill.id === CONTRADICTION_SPOTTING_SKILL_ID
      && initialTrainingProgressLoaded
      && trainingProgress
    ) {
      return trainingProgress.currentLevel;
    }

    return skill.level;
  }

  function isActivityUnlocked(skill: Skill, activity: SkillActivity) {
    if (activity.status === "Unlocked") {
      return true;
    }

    return getSkillLevel(skill) >= activity.level;
  }

  function getActivityStatusLabel(skill: Skill, activity: SkillActivity) {
    if (isActivityUnlocked(skill, activity) && !AVAILABLE_ACTIVITY_IDS.has(activity.id)) {
      return "Coming soon";
    }

    return isActivityUnlocked(skill, activity) ? "Unlocked" : "Locked";
  }

  function getActivityRequirements(skill: Skill, activity: SkillActivity) {
    if (skill.id === CONTRADICTION_SPOTTING_SKILL_ID) {
      return [`Reach Philosophical Thinking level ${activity.level}`];
    }

    return activity.requirements;
  }

  function getUnavailableActivityMessage(activity: SkillActivity) {
    if (AVAILABLE_ACTIVITY_IDS.has(activity.id)) {
      return null;
    }

    return "Training content for this activity has not been added yet.";
  }

  function getMissionCompletion(mission: Mission) {
    return mission.definition ? missionCompletions[mission.definition.slug] ?? null : null;
  }

  function getMissionStatusLabel(mission: Mission) {
    const completion = getMissionCompletion(mission);
    if (completion?.isCompleted) {
      return "Completed";
    }

    if (!missionProgressLoaded && mission.definition) {
      return "Loading";
    }

    return mission.status;
  }

  function getMissionStartLabel(mission: Mission) {
    return getMissionCompletion(mission)?.isCompleted ? "Replay Mission" : "Start Mission";
  }

  useEffect(() => {
    let mounted = true;

    const loadMissionProgress = async () => {
      try {
        const response = await apiFetch<LoadMissionsResponse>("/api/thinkertools-missions/missions");

        if (!mounted) {
          return;
        }

        setTrainingProgress(response.progress);
        setMissionCompletions(Object.fromEntries(
          response.missions.map((mission) => [
            mission.slug,
            {
              isCompleted: mission.isCompleted,
              completedAt: mission.completedAt,
              awardedXp: mission.awardedXp,
              replayCount: mission.replayCount,
              canReplay: mission.canReplay,
            },
          ]),
        ));

        // Update the missions list with live titles from the DB, preserving
        // the locked placeholder and any already-loaded definitions.
        setMissions((current) => {
          const dbSlugs = new Set(response.missions.map((m) => m.slug));
          const updated = current.map((m) => {
            const dbMission = response.missions.find((r) => r.slug === m.id);
            if (!dbMission) {
              return m;
            }

            return {
              ...m,
              id: dbMission.slug,
              title: dbMission.title,
              status: dbMission.isActive ? ("Available" as const) : ("Locked" as const),
            };
          });

          // Add any new missions from the DB that aren't already in the list
          const newMissions = response.missions
            .filter((r) => !current.some((m) => m.id === r.slug))
            .map((r) => ({
              id: r.slug,
              title: r.title,
              status: r.isActive ? ("Available" as const) : ("Locked" as const),
              requirements: [],
              revealedFacts: [],
              definition: undefined,
            }));

          return dbSlugs.size > 0 ? [...updated, ...newMissions] : current;
        });
      } catch {
        if (!mounted) {
          return;
        }

        setMissionCompletions({});
      } finally {
        if (mounted) {
          setMissionProgressLoaded(true);
        }
      }
    };

    void loadMissionProgress();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadInitialTrainingProgress = async () => {
      try {
        const response = await apiFetch<LoadContradictionResponse>(
          "/api/thinkertools-missions/training/contradiction-spotting",
        );

        if (!mounted) {
          return;
        }

        setTrainingProgress(response.progress);
        setContradictionRounds(response.rounds);
        setCompletedRoundSlugs(new Set(response.completedRoundSlugs));
      } catch {
        if (!mounted) {
          return;
        }

        setTrainingProgress(null);
      } finally {
        if (mounted) {
          setInitialTrainingProgressLoaded(true);
        }
      }
    };

    void loadInitialTrainingProgress();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (assistantQueue.length === 0) {
      return;
    }

    const nextMessage = assistantQueue[0];
    const timer = window.setTimeout(() => {
      setMessages((current) => [...current, nextMessage]);
      setAssistantQueue((current) => current.slice(1));
    }, getAssistantMessageDelay(nextMessage));

    return () => window.clearTimeout(timer);
  }, [assistantQueue]);

  useEffect(() => {
    const messageStack = messageStackRef.current;

    if (!messageStack) {
      return;
    }

    messageStack.scrollTop = messageStack.scrollHeight;
  }, [assistantQueue.length, messages.length]);

  function appendUserMessage(text: string) {
    const cleanText = text.trim();

    if (!cleanText) {
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: getMessageId("u"),
        role: "user",
        name: "You",
        body: cleanText,
      },
    ]);
  }

  function sendMessage(text: string) {
    const cleanText = text.trim();

    if (!cleanText) {
      return;
    }

    appendUserMessage(cleanText);
    setAssistantQueue((current) => [
      ...current,
      {
        id: getMessageId("a"),
        role: "assistant",
        name: "Mission Guide",
        body: "I have your response. The next version will connect this moment to mission state, scoring, and adaptive follow-up.",
      },
    ]);
    setDraft("");
  }

  function enqueueScriptMessages(
    scriptId: string,
    userAction: string,
    assistantBodies: string[],
    assistantFollowUps: Array<Omit<ChatMessage, "id" | "role" | "name">> = [],
  ) {
    setCurrentChatScript(scriptId);
    setMessages((current) => [
      ...current,
      {
        id: getMessageId(`u-${scriptId}`),
        role: "user",
        name: "You",
        body: userAction,
      },
    ]);
    setAssistantQueue((current) => [
      ...current,
      ...assistantBodies.map((body, index) => ({
        id: getMessageId(`a-${scriptId}-${index}`),
        role: "assistant" as const,
        name: "Mission Guide",
        body,
      })),
      ...assistantFollowUps.map((message, index) => ({
        ...message,
        id: getMessageId(`a-${scriptId}-follow-up-${index}`),
        role: "assistant" as const,
        name: "Mission Guide",
      })),
    ]);
  }

  function revealMissionFacts(factIds: readonly string[]) {
    setRevealedMissionFactIds((current) => {
      const next = new Set(current);
      factIds.forEach((factId) => next.add(factId));
      return next;
    });
  }

  function resetMissionEvaluationState() {
    setSelectedMissionClaimLabels([]);
    setMissionContradictionResult(null);
    setSelectedMissionResolutionId("");
    setMissionResolutionResult(null);
    setMissionInputError(null);
    setMissionCompleted(false);
  }

  function getMissionStageNumber(definition: MissionDefinition, stageId: string) {
    const stageIndex = definition.stages.findIndex((stage) => stage.id === stageId);
    return stageIndex >= 0 ? stageIndex + 1 : 0;
  }

  function getMissionStageActions(definition: MissionDefinition, stageId: string) {
    const stage = definition.stages.find((candidateStage) => candidateStage.id === stageId);

    if (!stage) {
      return [];
    }

    return stage.actionIds
      .map((actionId) => definition.actions.find((action) => action.id === actionId))
      .filter((action): action is MissionAction => Boolean(action));
  }

  function getMissionFacts(definition: MissionDefinition, factIds: readonly string[]) {
    return factIds
      .map((factId) => definition.facts.find((fact) => fact.id === factId))
      .filter((fact): fact is MissionFact => Boolean(fact));
  }

  function getMissionStageFollowUps(
    definition: MissionDefinition,
    stage: MissionDefinition["stages"][number],
  ): Array<Omit<ChatMessage, "id" | "role" | "name">> {
    const facts = getMissionFacts(definition, stage.revealedFactIds);
    const followUps: Array<Omit<ChatMessage, "id" | "role" | "name">> = facts.length > 0
      ? [{
          body: "New case facts have been added to the record.",
          missionFactDigest: {
            title: "Facts revealed",
            facts,
          },
        }]
      : [];

    if (stage.id === "briefing") {
      followUps.push({
        body: "These are the four dispute statements available for inspection.",
        missionStatementSet: {
          title: "Statements to inspect",
          claims: [...definition.characterClaims],
          detail: "role",
        },
      });
    }

    if (stage.id === "contradiction-review") {
      followUps.push({
        body: "Review the statements together before choosing the strongest conflict.",
        missionStatementSet: {
          title: "Statements under review",
          claims: [...definition.characterClaims],
          detail: "statement",
        },
      });
    }

    if (stage.id === "resolution-choice") {
      followUps.push({
        body: "Choose the resolution that best preserves the rule while repairing the exception it failed to handle.",
        missionResolutionSet: {
          title: "Resolution options",
          options: [...definition.resolutionOptions],
        },
      });
    }

    followUps.push({
      body: "Choose the next step in the case.",
      missionActionSet: {
        missionId: definition.id,
        stageId: stage.id,
        stageTitle: stage.title,
        actions: getMissionStageActions(definition, stage.id),
      },
    });

    return followUps;
  }

  function enqueueMissionStage(
    definition: MissionDefinition,
    stageId: string,
    userAction: string,
    prefaceMessages: string[] = [],
  ) {
    const stage = definition.stages.find((candidateStage) => candidateStage.id === stageId);
    if (!stage) {
      return;
    }

    const stageNumber = getMissionStageNumber(definition, stage.id);

    setCurrentQuestStage(stage.id);
    setMissionInputError(null);
    revealMissionFacts(stage.revealedFactIds);
    enqueueScriptMessages(`mission-${definition.slug}-${stage.id}`, userAction, [
      ...prefaceMessages,
      `Stage ${stageNumber}: ${stage.title}.`,
      stage.objective,
      ...stage.guideMessages,
    ], getMissionStageFollowUps(definition, stage));
  }

  function toggleMissionClaimLabel(label: string) {
    if (!isMissionContradictionActive) {
      return;
    }

    setMissionInputError(null);
    setSelectedMissionClaimLabels((current) => {
      const nextSelection = current.includes(label)
        ? current.filter((item) => item !== label)
        : current.length < 2
          ? [...current, label]
          : [current[1], label];

      return nextSelection;
    });
  }

  function selectMissionResolutionOption(optionId: string) {
    if (!isMissionResolutionActive) {
      return;
    }

    setMissionInputError(null);
    setSelectedMissionResolutionId((current) => current === optionId ? "" : optionId);
  }

  function submitMissionContradiction(typedInput: string) {
    if (!selectedMissionDefinition || !isMissionContradictionActive) {
      return;
    }

    const visibleLabels = selectedMissionDefinition.characterClaims.map((claim) => claim.label);
    const typedAnswer = typedInput.trim();
    let resolvedSelection = normalizeLabelSelection(selectedMissionClaimLabels);

    if (resolvedSelection.length !== 2 && typedAnswer) {
      const typedMatch = matchConstrainedTypedInput(typedAnswer, {
        visibleOptionLabels: visibleLabels,
        expectedSelectionCount: 2,
      });

      if (typedMatch.status === "invalid_input") {
        setMissionInputError(typedMatch.recoverableMessage);
        return;
      }

      resolvedSelection = normalizeLabelSelection(typedMatch.selectedLabels);
    }

    if (resolvedSelection.length !== 2) {
      setMissionInputError("Select or type two claim labels.");
      return;
    }

    const correctAnswerLabels = [...selectedMissionDefinition.contradictionReview.correctClaimLabels];
    const wasCorrect = isMatchingLabelPair(resolvedSelection, correctAnswerLabels);
    const submittedText = typedAnswer || resolvedSelection.join(" + ");
    const result = {
      wasCorrect,
      selectedLabels: resolvedSelection,
      correctAnswerLabels,
      explanation: selectedMissionDefinition.contradictionReview.explanation,
    };

    setMissionContradictionResult(result);
    setMissionInputError(null);
    setDraft("");

    if (!wasCorrect) {
      setSelectedMissionClaimLabels([]);
      enqueueScriptMessages(
        `mission-${selectedMissionDefinition.slug}-contradiction-retry`,
        submittedText,
        [
          "Not quite. Try another pair.",
          "Look for the two claims that cannot both guide the case unless one of them is revised or narrowed.",
        ],
      );
      return;
    }

    setSelectedMissionClaimLabels(resolvedSelection);
    revealMissionFacts(["central-contradiction"]);
    enqueueMissionStage(
      selectedMissionDefinition,
      "resolution-choice",
      submittedText,
      [`Correct. ${selectedMissionDefinition.contradictionReview.explanation}`],
    );
  }

  function submitMissionResolution(typedInput: string) {
    if (!selectedMissionDefinition || !isMissionResolutionActive) {
      return;
    }

    const visibleLabels = selectedMissionDefinition.resolutionOptions.map((option) => option.label);
    const typedAnswer = typedInput.trim();
    let selectedOption = selectedMissionDefinition.resolutionOptions.find((option) =>
      option.id === selectedMissionResolutionId,
    ) ?? null;

    if (!selectedOption && typedAnswer) {
      const typedMatch = matchConstrainedTypedInput(typedAnswer, {
        visibleOptionLabels: visibleLabels,
        expectedSelectionCount: 1,
      });

      if (typedMatch.status === "invalid_input") {
        setMissionInputError(typedMatch.recoverableMessage);
        return;
      }

      const [selectedLabel] = normalizeLabelSelection(typedMatch.selectedLabels);
      selectedOption = selectedMissionDefinition.resolutionOptions.find((option) =>
        option.label === selectedLabel,
      ) ?? null;
    }

    if (!selectedOption) {
      setMissionInputError("Select or type one resolution label.");
      return;
    }

    const wasCorrect = selectedOption.id === selectedMissionDefinition.resolutionReview.bestOptionId;
    const result = {
      wasCorrect,
      selectedOptionId: selectedOption.id,
      selectedOptionLabel: selectedOption.label,
      bestOptionId: selectedMissionDefinition.resolutionReview.bestOptionId,
      explanation: wasCorrect
        ? selectedMissionDefinition.resolutionReview.explanation
        : selectedOption.feedback,
    };
    const submittedText = typedAnswer || selectedOption.label;

    setMissionResolutionResult(result);
    setMissionInputError(null);
    setDraft("");

    if (!wasCorrect) {
      setSelectedMissionResolutionId("");
      enqueueScriptMessages(
        `mission-${selectedMissionDefinition.slug}-resolution-retry`,
        submittedText,
        [
          "That is not the strongest recommendation.",
          selectedOption.feedback,
          "Try a resolution that preserves rule consistency while repairing the emergency exception.",
        ],
      );
      return;
    }

    setSelectedMissionResolutionId(selectedOption.id);
    revealMissionFacts(["coherent-resolution"]);
    enqueueMissionStage(
      selectedMissionDefinition,
      "debrief",
      submittedText,
      [`Strongest recommendation. ${selectedMissionDefinition.resolutionReview.explanation}`],
    );
  }

  async function completeMission() {
    if (!selectedMissionDefinition || missionCompletionLoading) {
      return;
    }

    if (!missionContradictionResult?.wasCorrect || !missionResolutionResult?.wasCorrect) {
      setMissionInputError("Complete the contradiction and resolution steps before finishing the mission.");
      return;
    }

    setMissionCompletionLoading(true);
    setMissionInputError(null);

    try {
      const response = await apiFetch<CompleteMissionResponse>(
        `/api/thinkertools-missions/missions/${selectedMissionDefinition.slug}/complete`,
        {
          method: "POST",
          body: JSON.stringify({
            selectedContradictionLabels: missionContradictionResult.selectedLabels,
            selectedResolutionId: missionResolutionResult.selectedOptionId,
            completedStageIds: selectedMissionDefinition.stages.map((stage) => stage.id),
            revealedFactIds: Array.from(revealedMissionFactIds),
          }),
        },
      );

      setTrainingProgress(response.progress);
      setMissionCompleted(true);
      setMissionCompletions((current) => ({
        ...current,
        [response.mission.slug]: {
          isCompleted: response.completion.isCompleted,
          completedAt: response.completion.completedAt,
          awardedXp: response.completion.firstAwardedXp,
          replayCount: response.completion.replayCount,
          canReplay: response.completion.canReplay,
        },
      }));

      const xpMessage = response.completion.replayed
        ? "Replay complete. XP was already awarded for the first completion, so this run awards 0 XP."
        : `+${response.completion.awardedXp} ${selectedMissionDefinition.trainingTitle} XP awarded.`;
      const levelMessage = response.progress.leveledUp
        ? `Level up: ${selectedMissionDefinition.trainingTitle} level ${response.progress.currentLevel}.`
        : `Progress: ${response.progress.currentLevelXp}/${response.progress.xpRequiredForNextLevel} level XP.`;

      enqueueScriptMessages(
        `mission-${selectedMissionDefinition.slug}-complete`,
        "Complete Mission",
        [
          selectedMissionDefinition.debrief.completionMessage,
          xpMessage,
          levelMessage,
          selectedMissionDefinition.debrief.takeaway,
        ],
      );
    } catch (completeError) {
      const message = isApiRequestError(completeError)
        ? completeError.message
        : "Failed to complete mission.";
      setMissionInputError(message);
      setAssistantQueue((current) => [
        ...current,
        {
          id: getMessageId("a-mission-complete-error"),
          role: "assistant",
          name: "Mission Guide",
          body: message,
        },
      ]);
    } finally {
      setMissionCompletionLoading(false);
    }
  }

  async function handleMissionAction(action: MissionAction) {
    if (!selectedMissionDefinition) {
      return;
    }

    const inspectedClaim = selectedMissionDefinition.characterClaims.find((claim) =>
      action.id === `inspect-${claim.id}`,
    );

    if (inspectedClaim) {
      const facts = getMissionFacts(selectedMissionDefinition, inspectedClaim.revealedFactIds);

      revealMissionFacts(inspectedClaim.revealedFactIds);
      enqueueScriptMessages(
        `mission-${selectedMissionDefinition.slug}-${action.id}`,
        action.label,
        [
          `${inspectedClaim.label}. ${inspectedClaim.characterName}`,
          inspectedClaim.role,
          inspectedClaim.statement,
        ],
        facts.length > 0
          ? [{
              body: `${inspectedClaim.label} has been added to the case facts.`,
              missionFactDigest: {
                title: `Fact from statement ${inspectedClaim.label}`,
                facts,
              },
            }]
          : [],
      );
      return;
    }

    if (action.kind === "select-contradiction") {
      submitMissionContradiction(draft);
      return;
    }

    if (action.kind === "select-resolution") {
      submitMissionResolution(draft);
      return;
    }

    if (action.kind === "complete") {
      await completeMission();
      return;
    }

    if (action.kind === "handoff") {
      if (action.id === "return-to-dashboard") {
        setCurrentMode("feed");
        setCurrentQuestStage("none");
      }

      enqueueScriptMessages(
        `mission-${selectedMissionDefinition.slug}-${action.id}`,
        action.label,
        [selectedMissionDefinition.debrief.handoffMessage],
      );
      return;
    }

    if (action.targetStageId) {
      enqueueMissionStage(selectedMissionDefinition, action.targetStageId, action.label);
    }
  }

  function showQuestionBankStatus() {
    if (!activeRound || activeRoundNumber <= 0 || contradictionRounds.length === 0) {
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: getMessageId("u-activity-question-bank"),
        role: "user",
        name: "You",
        body: `Question Bank (${activeRoundNumber}/${contradictionRounds.length})`,
      },
      {
        id: getMessageId("a-activity-question-bank"),
        role: "assistant",
        name: "Mission Guide",
        body: "Question Bank",
        questionBank: true,
      },
    ]);
  }

  function openQuestionBankRound(round: ContradictionRound) {
    const roundIndex = contradictionRounds.findIndex((candidateRound) => candidateRound.slug === round.slug);
    if (roundIndex < 0 || getQuestionBankButtonState(round, roundIndex).isLocked) {
      return;
    }

    const interactionId = getMessageId(`round-${selectedActivity?.id ?? "activity"}`);

    setActiveRoundSlug(round.slug);
    setActiveTrainingInteractionId(interactionId);
    setSelectedLabels([]);
    setRoundResult(null);
    setTrainingError(null);
    setCurrentMode("activity");
    setMessages((current) => [
      ...current,
      {
        id: interactionId,
        role: "assistant",
        name: "Mission Guide",
        body: "Question selected from the bank.",
        trainingRound: {
          interactionId,
          round,
          selectedLabels: [],
          incorrectAttempts: 0,
          result: null,
        },
      },
    ]);
  }

  function getQuestionBankButtonState(round: ContradictionRound, index: number) {
    const isCompleted = completedRoundSlugs.has(round.slug);
    const isActive = round.slug === activeRoundSlug;
    const completedIndexes = contradictionRounds
      .map((candidateRound, candidateIndex) =>
        completedRoundSlugs.has(candidateRound.slug) ? candidateIndex : -1)
      .filter((candidateIndex) => candidateIndex >= 0);
    const furthestCompletedIndex = completedIndexes.length > 0
      ? Math.max(...completedIndexes)
      : -1;
    const unlockedThroughIndex = Math.max(activeRoundIndex, furthestCompletedIndex + 1);

    return {
      isActive,
      isCompleted,
      isLocked: !isCompleted && index > unlockedThroughIndex,
    };
  }

  async function loadMissionDefinition(missionSlug: string): Promise<MissionDefinition | null> {
    try {
      const response = await apiFetch<LoadMissionDefinitionResponse>(
        `/api/thinkertools-missions/missions/${missionSlug}`,
      );
      return response.definition;
    } catch {
      return null;
    }
  }

  async function selectMissionForChat(mission: Mission) {
    setSelectedMission(mission);

    if (selectedMission?.id === mission.id && currentMode === "quest") {
      return;
    }

    // Load the definition from the API if not already present
    let definition = mission.definition ?? null;
    if (!definition && mission.status === "Available") {
      definition = await loadMissionDefinition(mission.id);
      if (definition) {
        setMissions((current) =>
          current.map((m) =>
            m.id === mission.id ? { ...m, definition, revealedFacts: definition!.stages[0].revealedFactIds
              .flatMap((factId) => {
                const fact = definition!.facts.find((f) => f.id === factId);
                return fact ? [fact.body] : [];
              }) } : m,
          ),
        );
        // Update selectedMission with the loaded definition
        setSelectedMission((current) => current?.id === mission.id ? { ...current, definition } : current);
      }
    }

    enqueueScriptMessages(`mission-${mission.id}-selected`, `Open mission: ${mission.title}`, [
      getMissionCompletion(mission)?.isCompleted
        ? "Mission complete. You can replay it; replay completion will not award XP."
        : definition?.shortDescription ?? "Mission details are available in the case file.",
    ], [{
      body: mission.status === "Available"
        ? "This mission can start from the chat."
        : "This mission is not available yet.",
      missionStartPrompt: {
        missionId: mission.id,
        title: mission.title,
        status: mission.status,
        requirements: mission.requirements,
      },
    }]);
  }

  async function startQuest(mission: Mission) {
    if (mission.status === "Locked") {
      return;
    }

    // Load the definition from the API if not already present
    let definition = mission.definition ?? null;
    if (!definition) {
      definition = await loadMissionDefinition(mission.id);
      if (definition) {
        setMissions((current) =>
          current.map((m) => m.id === mission.id ? { ...m, definition } : m),
        );
      }
    }

    if (!definition) {
      return;
    }

    const openingStage = definition.stages[0];

    setSelectedMission({ ...mission, definition });
    setSelectedActivity(null);
    setCurrentMode("quest");
    setCurrentQuestStage(openingStage.id);
    setRevealedMissionFactIds(new Set(openingStage.revealedFactIds));
    resetMissionEvaluationState();
    setActiveTrainingInteractionId(null);
    setSelectedLabels([]);
    setRoundResult(null);
    enqueueScriptMessages(`mission-${definition.slug}-${openingStage.id}`, `Start mission: ${mission.title}`, [
      `${mission.title} is now active.`,
      `Stage 1: ${openingStage.title}.`,
      openingStage.objective,
      ...openingStage.guideMessages,
    ], getMissionStageFollowUps(definition, openingStage));
  }


  async function startActivity(skill: Skill, activity: SkillActivity) {
    if (activity.status === "Locked") {
      return;
    }

    setSelectedSkill(skill);
    setSelectedActivity(activity);
    setCurrentMode("activity");
    setCurrentQuestStage("none");
    setTrainingLoading(true);
    setTrainingError(null);
    setRoundResult(null);
    setSelectedLabels([]);
    setDraft("");
    appendUserMessage(`Start activity: ${activity.name}`);

    try {
      const response = await apiFetch<LoadContradictionResponse>(
        "/api/thinkertools-missions/training/contradiction-spotting",
      );
      const persistedCompletedRoundSlugs = new Set(response.completedRoundSlugs);
      const firstRound = response.rounds.find((round) => !persistedCompletedRoundSlugs.has(round.slug))
        ?? response.rounds[0]
        ?? null;

      setTrainingProgress(response.progress);
      setContradictionRounds(response.rounds);
      setCompletedRoundSlugs(persistedCompletedRoundSlugs);
      setActiveRoundSlug(firstRound?.slug ?? "");
      setCurrentChatScript(`activity-${activity.id}`);
      if (!firstRound) {
        setActiveTrainingInteractionId(null);
        setAssistantQueue((current) => [
          ...current,
          {
            id: getMessageId(`a-activity-${activity.id}`),
            role: "assistant",
            name: "Mission Guide",
            body: "No Contradiction Spotting training content is available yet.",
          },
        ]);
        return;
      }

      const interactionId = getMessageId(`round-${activity.id}`);
      setActiveTrainingInteractionId(interactionId);
      setMessages((current) => [
        ...current,
        {
          id: interactionId,
          role: "assistant",
          name: "Mission Guide",
          body: firstRound.expectedAnswerCount === 1
            ? "Contradiction Spotting is ready. Select or type one label."
            : "Contradiction Spotting is ready. Select or type two labels.",
          trainingRound: {
            interactionId,
            round: firstRound,
            selectedLabels: [],
            incorrectAttempts: 0,
            result: null,
          },
        },
      ]);
    } catch (loadError) {
      const message = isApiRequestError(loadError)
        ? loadError.message
        : "Failed to load Contradiction Spotting.";
      setTrainingError(message);
      setAssistantQueue((current) => [
        ...current,
        {
          id: getMessageId(`a-activity-${activity.id}-error`),
          role: "assistant",
          name: "Mission Guide",
          body: message,
        },
      ]);
    } finally {
      setTrainingLoading(false);
    }
  }

  function toggleClaimLabel(label: string) {
    if (roundResult || submittingTraining) {
      return;
    }

    const expectedCount = activeRound?.expectedAnswerCount ?? 2;

    setSelectedLabels((current) => {
      const nextSelection = current.includes(label)
        ? current.filter((item) => item !== label)
        : current.length < expectedCount
          ? [...current, label]
          : expectedCount === 1
            ? [label]
            : [current[1], label];

      if (activeTrainingInteractionId) {
        setMessages((messagesCurrent) => messagesCurrent.map((message) => {
          if (message.trainingRound?.interactionId !== activeTrainingInteractionId) {
            return message;
          }

          return {
            ...message,
            trainingRound: {
              ...message.trainingRound,
              selectedLabels: nextSelection,
            },
          };
        }));
      }

      return nextSelection;
    });
  }

  async function submitTrainingAnswer() {
    if (!activeRound || submittingTraining) {
      return;
    }

    const typedAnswer = draft.trim();
    const submittedText = typedAnswer || selectedLabels.join(" + ");

    if (!submittedText) {
      const expectedCount = activeRound.expectedAnswerCount ?? 2;
      setTrainingError(expectedCount === 1 ? "Select or type one label." : "Select or type two labels.");
      return;
    }

    appendUserMessage(submittedText);
    setSubmittingTraining(true);
    setTrainingError(null);

    try {
      const response = await apiFetch<SubmitContradictionResponse>(
        "/api/thinkertools-missions/training/contradiction-spotting/submit",
        {
          method: "POST",
          body: JSON.stringify({
            activitySlug: activeRound.slug,
            selectedLabels,
            typedAnswer,
          }),
        },
      );

      setTrainingProgress(response.progress);
      setDraft("");

      if (!response.result.wasCorrect) {
        setSelectedLabels([]);
        if (activeTrainingInteractionId) {
          setMessages((current) => current.map((message) => {
            if (message.trainingRound?.interactionId !== activeTrainingInteractionId) {
              return message;
            }

            return {
              ...message,
              trainingRound: {
                ...message.trainingRound,
                incorrectAttempts: message.trainingRound.incorrectAttempts + 1,
                selectedLabels: [],
              },
            };
          }));
        }
        setAssistantQueue((current) => [
          ...current,
          {
            id: getMessageId("a-training-retry"),
            role: "assistant",
            name: "Mission Guide",
            body: "Not quite. Try another pair. Look for the two claims that cannot both stay true without changing or qualifying one of them.",
          },
        ]);
        return;
      }

      setSelectedLabels(response.result.selectedLabels);
      setCompletedRoundSlugs((current) => {
        const next = new Set(current);
        next.add(activeRound.slug);
        return next;
      });
      if (activeTrainingInteractionId) {
        setMessages((current) => current.map((message) => {
          if (message.trainingRound?.interactionId !== activeTrainingInteractionId) {
            return message;
          }

          return {
            ...message,
            trainingRound: {
              ...message.trainingRound,
              selectedLabels: response.result.selectedLabels,
              result: response.result,
            },
          };
        }));
      }
      const activeRoundIndex = contradictionRounds.findIndex((round) => round.slug === activeRound.slug);
      const nextRound = activeRoundIndex >= 0
        ? contradictionRounds[activeRoundIndex + 1] ?? null
        : null;
      const nextInteractionId = nextRound
        ? getMessageId(`round-${selectedActivity?.id ?? "activity"}`)
        : null;

      if (nextRound && nextInteractionId) {
        setActiveRoundSlug(nextRound.slug);
        setActiveTrainingInteractionId(nextInteractionId);
        setSelectedLabels([]);
        setRoundResult(null);
      } else {
        setRoundResult(response.result);
      }

      setAssistantQueue((current) => [
        ...current,
        {
          id: getMessageId("a-training-result"),
          role: "assistant",
          name: "Mission Guide",
          body: `Correct. ${response.result.explanation} +${response.result.awardedXp} XP.`,
        },
        ...(nextRound && nextInteractionId
          ? [{
              id: nextInteractionId,
              role: "assistant" as const,
              name: "Mission Guide",
              body: nextRound.expectedAnswerCount === 1
                ? "Next Contradiction Spotting question is ready. Select or type one label."
                : "Next Contradiction Spotting question is ready. Select or type two labels.",
              trainingRound: {
                interactionId: nextInteractionId,
                round: nextRound,
                selectedLabels: [],
                incorrectAttempts: 0,
                result: null,
              },
            }]
          : []),
      ]);
    } catch (submitError) {
      const message = isApiRequestError(submitError)
        ? submitError.message
        : "Failed to submit answer.";
      setTrainingError(message);
      setAssistantQueue((current) => [
        ...current,
        {
          id: getMessageId("a-training-submit-error"),
          role: "assistant",
          name: "Mission Guide",
          body: message,
        },
      ]);
    } finally {
      setSubmittingTraining(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isTrainingRoundActive) {
      void submitTrainingAnswer();
      return;
    }

    if (isMissionContradictionActive) {
      submitMissionContradiction(draft);
      return;
    }

    if (isMissionResolutionActive) {
      submitMissionResolution(draft);
      return;
    }

    sendMessage(draft);
  }

  return (
    <main className={styles.page}>
      <div className={styles.workspace}>
        <div className={styles.leftRail}>
          <aside className={styles.profilePanel} aria-label="Player profile">
            <div className={styles.profileAvatar} aria-hidden="true">
              <div className={styles.avatarSilhouette}>
                <span>?</span>
              </div>
            </div>
            <div className={styles.profileContent}>
              <p className={styles.panelEyebrow}>Player Profile</p>
              <dl className={styles.profileFacts}>
                <div>
                  <dt>Name</dt>
                  <dd>???</dd>
                </div>
                <div>
                  <dt>Year</dt>
                  <dd>???</dd>
                </div>
              </dl>
            </div>
          </aside>

          <aside className={styles.skillsPanel} aria-label="Player skills">
            <div className={styles.panelHeading}>
              <h2>Training</h2>
            </div>
            <div className={styles.skillList}>
              {skills.map((skill) => (
                (() => {
                  const skillProgress = getSkillProgressDisplay(skill);

                  return (
                    <button
                      className={styles.skillItem}
                      key={skill.id}
                      onClick={() => {
                        setSelectedSkill(skill);
                        setSelectedActivity(null);
                      }}
                      type="button"
                    >
                      <strong>{skill.name}</strong>
                      {skillProgress.status === "loading" ? (
                        <span>Loading progress...</span>
                      ) : skillProgress.status === "unavailable" ? (
                        <span>Progress unavailable</span>
                      ) : (
                        <>
                          <span>Level {skillProgress.level}</span>
                          <span>{skillProgress.xp} XP</span>
                        </>
                      )}
                      {skillProgress.levelXp !== null && skillProgress.xpRequiredForNextLevel !== null ? (
                        <span>
                          {skillProgress.levelXp}/{skillProgress.xpRequiredForNextLevel} level XP
                        </span>
                      ) : null}
                    </button>
                  );
                })()
              ))}
            </div>
          </aside>

          <aside className={styles.skillDetailsPanel} aria-label="Skill details">
            {selectedSkill ? (
              <>
                <div className={styles.panelHeading}>
                  <h2>{selectedSkill.name}</h2>
                </div>
                <div className={styles.activityList}>
                  {selectedSkill.activities.map((activity) => {
                    const activityStatus = getActivityStatusLabel(selectedSkill, activity);
                    const activityUnlocked = activityStatus === "Unlocked";
                    const unavailableMessage = getUnavailableActivityMessage(activity);

                    return (
                      <div
                        className={`${styles.activityItem} ${
                          selectedActivity?.id === activity.id ? styles.selectedActivityItem : ""
                        }`}
                        key={activity.id}
                      >
                        <span>Level {activity.level}</span>
                        <strong>{activity.name}</strong>
                        <span>
                          {activity.xp} XP / {activityStatus}
                        </span>
                        {activityUnlocked && !unavailableMessage ? (
                          <button
                            className={styles.panelActionButton}
                            onClick={() => {
                              void startActivity(selectedSkill, activity);
                            }}
                            type="button"
                          >
                            {trainingLoading && selectedActivity?.id === activity.id ? "Loading..." : "Start Activity"}
                          </button>
                        ) : (
                          <div className={styles.lockedRequirements}>
                            <span>{unavailableMessage ? "Availability" : "Requirements"}</span>
                            <ul>
                              {(unavailableMessage
                                ? [unavailableMessage]
                                : getActivityRequirements(selectedSkill, activity)
                              ).map((requirement) => (
                                <li key={requirement}>{requirement}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className={styles.emptyDetails}>Click on a skill to open activities</p>
            )}
          </aside>
        </div>

        <section className={styles.chatShell} aria-label="Thinkertools Missions chat">
          <header className={styles.chatHeader}>
            <div>
              <p className={styles.eyebrow}>Thinkertools Missions</p>
              <h1>Mission Chat</h1>
            </div>
            <div className={styles.sessionMeta}>
              <span>{currentMode}</span>
              <span>{currentChatScript}</span>
              {currentQuestStage !== "none" ? <span>{currentQuestStage}</span> : null}
              <span>{messageCountLabel}</span>
            </div>
          </header>

          <div className={styles.messageStack} ref={messageStackRef}>
            {messages.map((message) => {
              const roundTranscript = message.trainingRound;
              const missionActionSet = message.missionActionSet;
              const missionFactDigest = message.missionFactDigest;
              const missionResolutionSet = message.missionResolutionSet;
              const missionStartPrompt = message.missionStartPrompt;
              const missionStatementSet = message.missionStatementSet;
              const isActiveRoundMessage = roundTranscript?.interactionId === activeTrainingInteractionId
                && currentMode === "activity"
                && !roundTranscript.result;
              const isActiveMissionActionSet = Boolean(
                missionActionSet
                  && currentMode === "quest"
                  && selectedMissionDefinition?.id === missionActionSet.missionId
                  && currentQuestStage === missionActionSet.stageId,
              );
              const missionForStartPrompt = missionStartPrompt
                ? missions.find((mission) => mission.id === missionStartPrompt.missionId) ?? null
                : null;
              const isStartPromptActive = Boolean(
                missionStartPrompt
                  && missionForStartPrompt
                  && selectedMission?.id === missionStartPrompt.missionId
                  && currentMode !== "quest"
                  && missionStartPrompt.status === "Available",
              );
              const canSelectMissionClaims = Boolean(
                missionStatementSet
                  && missionStatementSet.detail === "statement"
                  && isMissionContradictionActive,
              );
              const canSelectMissionResolution = Boolean(missionResolutionSet && isMissionResolutionActive);

              return (
              <article
                className={`${styles.messageRow} ${
                  message.role === "user" ? styles.userRow : styles.assistantRow
                }`}
                key={message.id}
              >
                <div className={styles.avatar} aria-hidden="true">
                  {message.role === "user" ? "Y" : "M"}
                </div>
                {missionStartPrompt ? (
                  <section className={styles.missionActionCard} aria-label={`${missionStartPrompt.title} mission start`}>
                    <div className={styles.missionActionHeader}>
                      <strong>{missionStartPrompt.title}</strong>
                      <span>
                        {missionForStartPrompt ? getMissionStatusLabel(missionForStartPrompt) : missionStartPrompt.status}
                      </span>
                    </div>
                    <p>{message.body}</p>
                    <div className={styles.missionRequirementList}>
                      {missionStartPrompt.requirements.map((requirement) => (
                        <span key={requirement}>{requirement}</span>
                      ))}
                    </div>
                    <div className={styles.missionChatActions}>
                      <button
                        disabled={!isStartPromptActive}
                        onClick={() => {
                          if (missionForStartPrompt) {
                            void startQuest(missionForStartPrompt);
                          }
                        }}
                        type="button"
                      >
                        {currentMode === "quest" && selectedMission?.id === missionStartPrompt.missionId
                          ? "Mission in progress"
                          : missionForStartPrompt
                            ? getMissionStartLabel(missionForStartPrompt)
                            : "Start Mission"}
                      </button>
                    </div>
                  </section>
                ) : missionFactDigest ? (
                  <section className={styles.missionInfoCard} aria-label={missionFactDigest.title}>
                    <div className={styles.missionInfoHeader}>
                      <strong>{missionFactDigest.title}</strong>
                      <span>Case file</span>
                    </div>
                    <p>{message.body}</p>
                    <div className={styles.missionFactList}>
                      {missionFactDigest.facts.map((fact) => (
                        <div className={styles.missionFactItem} key={fact.id}>
                          <strong>{fact.label}</strong>
                          <p>{fact.body}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : missionStatementSet ? (
                  <section className={styles.missionInfoCard} aria-label={missionStatementSet.title}>
                    <div className={styles.missionInfoHeader}>
                      <strong>{missionStatementSet.title}</strong>
                      <span>Evidence</span>
                    </div>
                    <p>{message.body}</p>
                    <div className={styles.missionStatementList}>
                      {missionStatementSet.claims.map((claim) => (
                        <button
                          className={`${styles.missionStatementItem} ${
                            selectedMissionClaimLabels.includes(claim.label) ? styles.selectedMissionChoice : ""
                          } ${
                            missionContradictionResult?.wasCorrect
                              && missionContradictionResult.correctAnswerLabels.includes(claim.label)
                              ? styles.correctMissionChoice
                              : ""
                          }`}
                          disabled={!canSelectMissionClaims}
                          key={claim.id}
                          onClick={() => toggleMissionClaimLabel(claim.label)}
                          type="button"
                        >
                          <span>{claim.label}</span>
                          <div>
                            <strong>{claim.characterName}</strong>
                            <p>{missionStatementSet.detail === "statement" ? claim.statement : claim.role}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                ) : missionResolutionSet ? (
                  <section className={styles.missionInfoCard} aria-label={missionResolutionSet.title}>
                    <div className={styles.missionInfoHeader}>
                      <strong>{missionResolutionSet.title}</strong>
                      <span>Recommendation</span>
                    </div>
                    <p>{message.body}</p>
                    <div className={styles.missionStatementList}>
                      {missionResolutionSet.options.map((option) => (
                        <button
                          className={`${styles.missionStatementItem} ${
                            selectedMissionResolutionId === option.id ? styles.selectedMissionChoice : ""
                          } ${
                            missionResolutionResult?.wasCorrect
                              && missionResolutionResult.bestOptionId === option.id
                              ? styles.correctMissionChoice
                              : ""
                          }`}
                          disabled={!canSelectMissionResolution}
                          key={option.id}
                          onClick={() => selectMissionResolutionOption(option.id)}
                          type="button"
                        >
                          <span>{option.label}</span>
                          <div>
                            <p>{option.body}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                ) : missionActionSet ? (
                  <section className={styles.missionActionCard} aria-label={`${missionActionSet.stageTitle} actions`}>
                    <div className={styles.missionActionHeader}>
                      <strong>{missionActionSet.stageTitle}</strong>
                      <span>{isActiveMissionActionSet ? "Current" : "Closed"}</span>
                    </div>
                    <p>{message.body}</p>
                    <div className={styles.missionChatActions}>
                      {missionActionSet.actions.map((action) => (
                        <button
                          disabled={
                            !isActiveMissionActionSet
                            || (action.kind === "complete" && (missionCompletionLoading || missionCompleted))
                          }
                          key={action.id}
                          onClick={() => {
                            void handleMissionAction(action);
                          }}
                          type="button"
                        >
                          {action.kind === "complete" && missionCompletionLoading
                            ? "Completing..."
                            : action.kind === "complete" && missionCompleted
                              ? "Completed"
                              : action.label}
                        </button>
                      ))}
                    </div>
                    {isActiveMissionActionSet && missionInputError ? (
                      <p className={styles.trainingError}>{missionInputError}</p>
                    ) : null}
                  </section>
                ) : message.questionBank ? (
                  <section className={styles.questionBankDiagram} aria-label="Question bank">
                    <div className={styles.questionBankHeader}>
                      <strong>Question Bank</strong>
                      <span>{activeRoundNumber}/{contradictionRounds.length}</span>
                    </div>
                    <div className={styles.questionBankButtons}>
                      {contradictionRounds.map((round, index) => {
                        const questionNumber = index + 1;
                        const buttonState = getQuestionBankButtonState(round, index);

                        return (
                          <button
                            className={`${styles.questionBankButton} ${
                              buttonState.isCompleted ? styles.completedQuestionBankButton : ""
                            } ${
                              buttonState.isActive && !buttonState.isCompleted ? styles.activeQuestionBankButton : ""
                            } ${
                              buttonState.isLocked ? styles.lockedQuestionBankButton : ""
                            }`}
                            disabled={buttonState.isLocked}
                            key={round.slug}
                            onClick={() => openQuestionBankRound(round)}
                            type="button"
                            aria-label={`Question ${questionNumber}${buttonState.isLocked ? " locked" : ""}`}
                          >
                            <span>{questionNumber}</span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ) : roundTranscript ? (
                  <section className={styles.trainingRound} aria-label="Training question">
                    <div className={styles.trainingRoundHeader}>
                      <span>{roundTranscript.round.difficultyLabel}</span>
                      <strong>{CONTRADICTION_SPOTTING_DISPLAY_TITLE}</strong>
                      <span>{roundTranscript.round.xpReward} XP</span>
                    </div>
                    <p className={styles.trainingQuestion}>{roundTranscript.round.questionText}</p>
                    <p>
                      {roundTranscript.round.expectedAnswerCount === 1
                        ? "Select the one claim that best fits."
                        : "Select the two claims in strongest contradiction."}
                    </p>
                    <div className={styles.claimList}>
                      {roundTranscript.round.promptClaims.map((claim) => {
                        const isSelected = roundTranscript.selectedLabels.includes(claim.label);
                        const isCorrect = roundTranscript.result?.correctAnswerLabels.includes(claim.label) ?? false;
                        return (
                          <button
                            className={`${styles.claimButton} ${
                              isSelected ? styles.selectedClaimButton : ""
                            } ${roundTranscript.result && isCorrect ? styles.correctClaimButton : ""}`}
                            disabled={!isActiveRoundMessage || submittingTraining}
                            key={claim.label}
                            onClick={() => toggleClaimLabel(claim.label)}
                            type="button"
                          >
                            <span>{claim.label}</span>
                            <strong>{claim.text}</strong>
                          </button>
                        );
                      })}
                    </div>
                    {isActiveRoundMessage && trainingError ? (
                      <p className={styles.trainingError}>{trainingError}</p>
                    ) : null}
                    {roundTranscript.result ? (
                      <div className={styles.trainingFeedback}>
                        <strong>{roundTranscript.result.wasCorrect ? "Correct" : "Review"}</strong>
                        <p>{roundTranscript.result.explanation}</p>
                        <span>
                          Selected {roundTranscript.result.selectedLabels.join(" + ")} / +{roundTranscript.result.awardedXp} XP
                        </span>
                      </div>
                    ) : null}
                    {isActiveRoundMessage && roundTranscript.incorrectAttempts > 0 ? (
                      <div className={`${styles.trainingFeedback} ${styles.retryFeedback}`}>
                        <strong>Try again</strong>
                        <p>Attempt {roundTranscript.incorrectAttempts}. Choose a different pair.</p>
                      </div>
                    ) : null}
                    {isActiveRoundMessage && trainingProgress ? (
                      <div className={styles.trainingProgress}>
                        Level {trainingProgress.currentLevel} / {trainingProgress.totalXp} XP total
                      </div>
                    ) : null}
                  </section>
                ) : (
                  <div className={styles.bubble}>
                    <div className={styles.messageName}>{message.name}</div>
                    <p>{message.body}</p>
                  </div>
                )}
              </article>
              );
            })}
          </div>

          {shouldShowQuestionBankButton ? (
            <div className={styles.activityActionBar}>
              <button type="button" onClick={showQuestionBankStatus}>
                Question Bank ({activeRoundNumber}/{contradictionRounds.length})
              </button>
            </div>
          ) : null}

          <form className={styles.composer} onSubmit={handleSubmit}>
            <label className={styles.composerLabel} htmlFor="mission-chat-input">
              Message
            </label>
            <textarea
              id="mission-chat-input"
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about your next mission..."
              rows={3}
              value={draft}
            />
            <button disabled={!canSend} type="submit">
              {submittingTraining
                ? "Submitting..."
                : isTrainingRoundActive || isMissionContradictionActive || isMissionResolutionActive
                  ? "Submit"
                  : "Send"}
            </button>
          </form>
        </section>

        <div className={styles.rightRail}>
          <aside className={styles.missionPanel} aria-label="Missions">
            <div className={styles.panelHeading}>
              <h2>Missions</h2>
            </div>
            <div className={styles.missionList}>
              {missions.map((mission) => (
                <button
                  className={`${styles.missionItem} ${
                    selectedMission?.id === mission.id ? styles.selectedMissionItem : ""
                  }`}
                  key={mission.id}
                  onClick={() => void selectMissionForChat(mission)}
                  type="button"
                >
                  <strong>{mission.title}</strong>
                  <span className={styles.missionStatus}>{getMissionStatusLabel(mission)}</span>
                </button>
              ))}
            </div>
          </aside>

          <aside className={styles.missionDetailsPanel} aria-label="Mission details">
            {selectedMission ? (
              <>
                <div className={styles.panelHeading}>
                  <h2>{selectedMission.title}</h2>
                  {selectedMissionDefinition ? (
                    <p>{selectedMissionDefinition.shortDescription}</p>
                  ) : null}
                </div>

                <section className={styles.requirementsBlock}>
                  <h3>Start Requirements</h3>
                  <ul>
                    {selectedMission.requirements.map((requirement) => (
                      <li key={requirement}>{requirement}</li>
                    ))}
                  </ul>
                </section>

                {selectedMissionCompletion?.isCompleted ? (
                  <section className={styles.stageBlock}>
                    <div>
                      <span>Completed</span>
                      <h3>{selectedMissionCompletion.canReplay ? "Replay available" : "Mission complete"}</h3>
                    </div>
                    <p>
                      First completion XP: {selectedMissionCompletion.awardedXp}.
                      Replays completed: {selectedMissionCompletion.replayCount}.
                    </p>
                  </section>
                ) : null}

                {selectedMissionDefinition && activeMissionStage ? (
                  <section className={styles.stageBlock}>
                    <div>
                      <span>
                        Stage {getMissionStageNumber(selectedMissionDefinition, activeMissionStage.id)}
                      </span>
                      <h3>{activeMissionStage.title}</h3>
                    </div>
                    <p>{activeMissionStage.objective}</p>
                  </section>
                ) : selectedMissionDefinition ? (
                  <section className={styles.stageBlock}>
                    <div>
                      <span>{selectedMissionDefinition.missionType}</span>
                      <h3>{selectedMissionDefinition.trainingTitle}</h3>
                    </div>
                    <p>{selectedMissionDefinition.narrativeHook}</p>
                  </section>
                ) : null}

                <section className={styles.factsBlock}>
                  <h3>Revealed Facts</h3>
                  {selectedMissionDefinition && revealedMissionFacts.length > 0 ? (
                    <ul>
                      {revealedMissionFacts.map((fact) => (
                        <li key={fact.id}>
                          <strong>{fact.label}:</strong> {fact.body}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <ul>
                      {selectedMission.revealedFacts.map((fact) => (
                        <li key={fact}>{fact}</li>
                      ))}
                    </ul>
                  )}
                </section>

                {selectedMissionDefinition && activeMissionStage?.id === "briefing" ? (
                  <section className={styles.claimsBlock}>
                    <h3>Statements</h3>
                    <div className={styles.claimSummaryList}>
                      {selectedMissionDefinition.characterClaims.map((claim) => (
                        <div className={styles.claimSummaryItem} key={claim.id}>
                          <span>{claim.label}</span>
                          <div>
                            <strong>{claim.characterName}</strong>
                            <p>{claim.role}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {selectedMissionDefinition && activeMissionStage?.id === "contradiction-review" ? (
                  <section className={styles.claimsBlock}>
                    <h3>{selectedMissionDefinition.contradictionReview.prompt}</h3>
                    <div className={styles.claimSummaryList}>
                      {selectedMissionDefinition.characterClaims.map((claim) => (
                        <button
                          className={`${styles.claimSummaryItem} ${
                            selectedMissionClaimLabels.includes(claim.label) ? styles.selectedMissionChoice : ""
                          }`}
                          disabled={!isMissionContradictionActive}
                          key={claim.id}
                          onClick={() => toggleMissionClaimLabel(claim.label)}
                          type="button"
                        >
                          <span>{claim.label}</span>
                          <div>
                            <strong>{claim.characterName}</strong>
                            <p>{claim.statement}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                    {missionContradictionResult ? (
                      <div className={`${styles.trainingFeedback} ${
                        missionContradictionResult.wasCorrect ? "" : styles.retryFeedback
                      }`}>
                        <strong>{missionContradictionResult.wasCorrect ? "Correct" : "Review"}</strong>
                        <p>{missionContradictionResult.explanation}</p>
                      </div>
                    ) : null}
                    {isMissionContradictionActive && missionInputError ? (
                      <p className={styles.trainingError}>{missionInputError}</p>
                    ) : null}
                  </section>
                ) : null}

                {selectedMissionDefinition && activeMissionStage?.id === "resolution-choice" ? (
                  <section className={styles.claimsBlock}>
                    <h3>{selectedMissionDefinition.resolutionReview.prompt}</h3>
                    <div className={styles.resolutionList}>
                      {selectedMissionDefinition.resolutionOptions.map((option) => (
                        <button
                          className={`${styles.resolutionItem} ${
                            selectedMissionResolutionId === option.id ? styles.selectedMissionChoice : ""
                          }`}
                          disabled={!isMissionResolutionActive}
                          key={option.id}
                          onClick={() => selectMissionResolutionOption(option.id)}
                          type="button"
                        >
                          <span>{option.label}</span>
                          <p>{option.body}</p>
                        </button>
                      ))}
                    </div>
                    {missionResolutionResult ? (
                      <div className={`${styles.trainingFeedback} ${
                        missionResolutionResult.wasCorrect ? "" : styles.retryFeedback
                      }`}>
                        <strong>{missionResolutionResult.wasCorrect ? "Strongest" : "Review"}</strong>
                        <p>{missionResolutionResult.explanation}</p>
                      </div>
                    ) : null}
                    {isMissionResolutionActive && missionInputError ? (
                      <p className={styles.trainingError}>{missionInputError}</p>
                    ) : null}
                  </section>
                ) : null}

                {selectedMissionDefinition && activeMissionStage?.id === "debrief" ? (
                  <section className={styles.claimsBlock}>
                    <h3>{missionCompleted ? "Mission complete" : "Ready to complete"}</h3>
                    <p>{selectedMissionDefinition.debrief.takeaway}</p>
                    <p>{selectedMissionDefinition.debrief.handoffMessage}</p>
                  </section>
                ) : null}

              </>
            ) : (
              <p className={styles.emptyDetails}>Click on a mission to open details</p>
            )}
          </aside>

          <KanePlayerButton onStep={() => void refreshProgress()} />
        </div>
      </div>
    </main>
  );
}
