"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { apiFetch, isApiRequestError } from "@/components/quipx/client";

import styles from "./thinkertools-missions-chat.module.css";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  name: string;
  body: string;
  trainingRound?: TrainingRoundTranscript;
  questionBank?: boolean;
};

type ChatMode = "feed" | "quest" | "activity";
type QuestStage = "none" | "intake";

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

type LoadContradictionResponse = {
  skill: {
    id: string;
    slug: string;
    title: string;
  };
  progress: ProgressState;
  rounds: ContradictionRound[];
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
  type: "Mission" | "Quest";
  status: "Available" | "Locked";
  requirements: string[];
  revealedFacts: string[];
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

const missions: Mission[] = [
  {
    id: "wrong-recruit",
    title: "The Wrong Recruit",
    type: "Quest",
    status: "Available",
    requirements: ["Name must be revealed", "Current year must be revealed"],
    revealedFacts: [
      "A recruit file has been opened before identity confirmation.",
      "The year attached to the case is still unknown.",
      "The first decision point has not been reached.",
    ],
  },
  {
    id: "missing-premise",
    title: "Missing Premise",
    type: "Mission",
    status: "Locked",
    requirements: ["Complete the first quest intake", "Reveal one player profile field"],
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

  const activeRound = useMemo(
    () => contradictionRounds.find((round) => round.slug === activeRoundSlug) ?? null,
    [activeRoundSlug, contradictionRounds],
  );
  const activeRoundIndex = useMemo(
    () => contradictionRounds.findIndex((round) => round.slug === activeRoundSlug),
    [activeRoundSlug, contradictionRounds],
  );
  const activeRoundNumber = activeRoundIndex >= 0 ? activeRoundIndex + 1 : 0;
  const isTrainingRoundActive = currentMode === "activity" && Boolean(activeRound) && !roundResult;
  const shouldShowQuestionBankButton = currentMode === "activity"
    && Boolean(activeRound)
    && contradictionRounds.length > 0;
  const activeTrainingSkillId = selectedActivity ? selectedSkill?.id ?? null : null;
  const canSend = isTrainingRoundActive
    ? draft.trim().length > 0 || selectedLabels.length === 2
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

  function enqueueScriptMessages(scriptId: string, userAction: string, assistantBodies: string[]) {
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
    ]);
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

  function startQuest(mission: Mission) {
    if (mission.status === "Locked") {
      return;
    }

    setSelectedMission(mission);
    setSelectedActivity(null);
    setCurrentMode("quest");
    setCurrentQuestStage("intake");
    setActiveTrainingInteractionId(null);
    setSelectedLabels([]);
    setRoundResult(null);
    enqueueScriptMessages(`quest-${mission.id}-intake`, `Start quest: ${mission.title}`, [
      `${mission.title} is now active.`,
      "Stage 1: intake. The mission details panel will keep requirements and revealed facts visible while the chat handles decisions.",
      "First task: review the revealed facts, then tell me which one feels least stable.",
    ]);
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
      const firstRound = response.rounds[0] ?? null;

      setTrainingProgress(response.progress);
      setContradictionRounds(response.rounds);
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
          body: "Contradiction Spotting is ready. Select or type two labels.",
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

    setSelectedLabels((current) => {
      const nextSelection = current.includes(label)
        ? current.filter((item) => item !== label)
        : current.length < 2
          ? [...current, label]
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
      setTrainingError("Select or type two labels.");
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
              body: "Next Contradiction Spotting question is ready. Select or type two labels.",
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

          <div className={styles.messageStack}>
            {messages.map((message) => {
              const roundTranscript = message.trainingRound;
              const isActiveRoundMessage = roundTranscript?.interactionId === activeTrainingInteractionId
                && currentMode === "activity"
                && !roundTranscript.result;

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
                {message.questionBank ? (
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
              {submittingTraining ? "Submitting..." : isTrainingRoundActive ? "Submit" : "Send"}
            </button>
          </form>
        </section>

        <div className={styles.rightRail}>
          <aside className={styles.missionPanel} aria-label="Missions and quests">
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
                  onClick={() => setSelectedMission(mission)}
                  type="button"
                >
                  <span className={styles.missionType}>{mission.type}</span>
                  <strong>{mission.title}</strong>
                  <span className={styles.missionStatus}>{mission.status}</span>
                </button>
              ))}
            </div>
          </aside>

          <aside className={styles.missionDetailsPanel} aria-label="Mission details">
            {selectedMission ? (
              <>
                <div className={styles.panelHeading}>
                  <span className={styles.missionType}>{selectedMission.type}</span>
                  <h2>{selectedMission.title}</h2>
                </div>

                <section className={styles.requirementsBlock}>
                  <h3>Start Requirements</h3>
                  <ul>
                    {selectedMission.requirements.map((requirement) => (
                      <li key={requirement}>{requirement}</li>
                    ))}
                  </ul>
                </section>

                <section className={styles.factsBlock}>
                  <h3>Revealed Facts</h3>
                  <ul>
                    {selectedMission.revealedFacts.map((fact) => (
                      <li key={fact}>{fact}</li>
                    ))}
                  </ul>
                </section>

                {selectedMission.status === "Available" ? (
                  <button
                    className={styles.panelActionButton}
                    onClick={() => startQuest(selectedMission)}
                    type="button"
                  >
                    Start Quest
                  </button>
                ) : null}
              </>
            ) : (
              <p className={styles.emptyDetails}>Click on a quest to open details</p>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
