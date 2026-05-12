"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { apiFetch, isApiRequestError } from "@/components/quipx/client";

import styles from "./thinkertools-missions-chat.module.css";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  name: string;
  body: string;
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

const suggestedReplies = [
  "Start a reasoning mission",
  "Show me the mission context",
  "Give me a small challenge",
];

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
  const [trainingProgress, setTrainingProgress] = useState<ProgressState | null>(null);
  const [contradictionRounds, setContradictionRounds] = useState<ContradictionRound[]>([]);
  const [activeRoundSlug, setActiveRoundSlug] = useState("");
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [roundResult, setRoundResult] = useState<SubmitContradictionResponse["result"] | null>(null);
  const [submittingTraining, setSubmittingTraining] = useState(false);
  const messageIdCounter = useRef(0);

  const activeRound = useMemo(
    () => contradictionRounds.find((round) => round.slug === activeRoundSlug) ?? null,
    [activeRoundSlug, contradictionRounds],
  );
  const isTrainingRoundActive = currentMode === "activity" && Boolean(activeRound) && !roundResult;
  const canSend = draft.trim().length > 0 || selectedLabels.length === 2;
  const messageCountLabel = useMemo(
    () => `${messages.length} message${messages.length === 1 ? "" : "s"}`,
    [messages.length],
  );

  function getMessageId(prefix: string) {
    messageIdCounter.current += 1;
    return `${prefix}-${messageIdCounter.current}`;
  }

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

  function startQuest(mission: Mission) {
    if (mission.status === "Locked") {
      return;
    }

    setSelectedMission(mission);
    setSelectedActivity(null);
    setCurrentMode("quest");
    setCurrentQuestStage("intake");
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
      setAssistantQueue((current) => [
        ...current,
        {
          id: getMessageId(`a-activity-${activity.id}`),
          role: "assistant",
          name: "Mission Guide",
          body: firstRound
            ? `${firstRound.questionText} Select or type two labels.`
            : "No Contradiction Spotting training content is available yet.",
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
      if (current.includes(label)) {
        return current.filter((item) => item !== label);
      }

      if (current.length < 2) {
        return [...current, label];
      }

      return [current[1], label];
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

      setRoundResult(response.result);
      setTrainingProgress(response.progress);
      setSelectedLabels(response.result.selectedLabels);
      setDraft("");
      setAssistantQueue((current) => [
        ...current,
        {
          id: getMessageId("a-training-result"),
          role: "assistant",
          name: "Mission Guide",
          body: response.result.wasCorrect
            ? `Correct. ${response.result.explanation} +${response.result.awardedXp} XP.`
            : `Not quite. The strongest pair is ${response.result.correctAnswerLabels.join(" + ")}. ${response.result.explanation}`,
        },
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
                  <span>Level {skill.level}</span>
                  <span>{skill.xp} XP</span>
                </button>
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
                  {selectedSkill.activities.map((activity) => (
                    <div
                      className={`${styles.activityItem} ${
                        selectedActivity?.id === activity.id ? styles.selectedActivityItem : ""
                      }`}
                      key={activity.id}
                    >
                      <span>Level {activity.level}</span>
                      <strong>{activity.name}</strong>
                      <span>
                        {activity.xp} XP / {activity.status}
                      </span>
                      {activity.status === "Unlocked" ? (
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
                          <span>Requirements</span>
                          <ul>
                            {activity.requirements.map((requirement) => (
                              <li key={requirement}>{requirement}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
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
            {messages.map((message) => (
              <article
                className={`${styles.messageRow} ${
                  message.role === "user" ? styles.userRow : styles.assistantRow
                }`}
                key={message.id}
              >
                <div className={styles.avatar} aria-hidden="true">
                  {message.role === "user" ? "Y" : "M"}
                </div>
                <div className={styles.bubble}>
                  <div className={styles.messageName}>{message.name}</div>
                  <p>{message.body}</p>
                </div>
              </article>
            ))}

            {activeRound ? (
              <section className={styles.trainingRound} aria-label="Active training question">
                <div className={styles.trainingRoundHeader}>
                  <span>{activeRound.difficultyLabel}</span>
                  <strong>{activeRound.title}</strong>
                  <span>{activeRound.xpReward} XP</span>
                </div>
                <p className={styles.trainingQuestion}>{activeRound.questionText}</p>
                <div className={styles.claimList}>
                  {activeRound.promptClaims.map((claim) => {
                    const isSelected = selectedLabels.includes(claim.label);
                    const isCorrect = roundResult?.correctAnswerLabels.includes(claim.label) ?? false;
                    return (
                      <button
                        className={`${styles.claimButton} ${
                          isSelected ? styles.selectedClaimButton : ""
                        } ${roundResult && isCorrect ? styles.correctClaimButton : ""}`}
                        disabled={Boolean(roundResult) || submittingTraining}
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
                {trainingError ? <p className={styles.trainingError}>{trainingError}</p> : null}
                {roundResult ? (
                  <div className={styles.trainingFeedback}>
                    <strong>{roundResult.wasCorrect ? "Correct" : "Review"}</strong>
                    <p>{roundResult.explanation}</p>
                    <span>
                      Selected {roundResult.selectedLabels.join(" + ")} / Correct{" "}
                      {roundResult.correctAnswerLabels.join(" + ")} / +{roundResult.awardedXp} XP
                    </span>
                  </div>
                ) : null}
                {trainingProgress ? (
                  <div className={styles.trainingProgress}>
                    Level {trainingProgress.currentLevel} / {trainingProgress.totalXp} XP total
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>

          <div className={styles.suggestionBar} aria-label="Suggested replies">
            {suggestedReplies.map((reply) => (
              <button key={reply} type="button" onClick={() => sendMessage(reply)}>
                {reply}
              </button>
            ))}
          </div>

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
