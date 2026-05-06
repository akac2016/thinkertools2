"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import styles from "./thinkertools-missions-chat.module.css";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  name: string;
  body: string;
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
  level: number;
  name: string;
  xp: number;
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
    id: "contradiction-spotting",
    name: "Contradiction Spotting",
    level: 1,
    xp: 40,
    activities: [
      { level: 1, name: "Choose the conflicting claim pair", xp: 20 },
      { level: 2, name: "Explain why two claims cannot both hold", xp: 45 },
      { level: 3, name: "Resolve a contradiction under missing context", xp: 80 },
    ],
  },
  {
    id: "premise-testing",
    name: "Premise Testing",
    level: 1,
    xp: 0,
    activities: [
      { level: 1, name: "Identify an unstated assumption", xp: 25 },
      { level: 2, name: "Rank premises by evidential strength", xp: 55 },
      { level: 3, name: "Revise a weak argument without changing its conclusion", xp: 90 },
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
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);

  const canSend = draft.trim().length > 0;
  const messageCountLabel = useMemo(
    () => `${messages.length} message${messages.length === 1 ? "" : "s"}`,
    [messages.length],
  );

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

  function sendMessage(text: string) {
    const cleanText = text.trim();

    if (!cleanText) {
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: `u-${Date.now()}`,
        role: "user",
        name: "You",
        body: cleanText,
      },
    ]);
    setAssistantQueue((current) => [
      ...current,
      {
        id: `a-${Date.now()}`,
        role: "assistant",
        name: "Mission Guide",
        body: "I have your response. The next version will connect this moment to mission state, scoring, and adaptive follow-up.",
      },
    ]);
    setDraft("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
              <p className={styles.panelEyebrow}>Skills</p>
              <h2>Training</h2>
            </div>
            <div className={styles.skillList}>
              {skills.map((skill) => (
                <button
                  className={styles.skillItem}
                  key={skill.id}
                  onClick={() => setSelectedSkill(skill)}
                  type="button"
                >
                  <strong>{skill.name}</strong>
                  <span>Level {skill.level}</span>
                  <span>{skill.xp} XP</span>
                </button>
              ))}
            </div>
          </aside>
        </div>

        <section className={styles.chatShell} aria-label="Thinkertools Missions chat">
          <header className={styles.chatHeader}>
            <div>
              <p className={styles.eyebrow}>Thinkertools Missions</p>
              <h1>Mission Chat</h1>
            </div>
            <div className={styles.sessionMeta}>
              <span>Prototype</span>
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
              Send
            </button>
          </form>
        </section>

        <aside className={styles.missionPanel} aria-label="Missions and quests">
          <div className={styles.panelHeading}>
            <p className={styles.panelEyebrow}>Mission</p>
            <h2>Quests</h2>
          </div>
          <div className={styles.missionList}>
            {missions.map((mission) => (
              <button
                className={styles.missionItem}
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
      </div>

      {selectedMission ? (
        <div
          className={styles.modalBackdrop}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedMission(null);
            }
          }}
        >
          <section
            aria-labelledby="mission-dialog-title"
            aria-modal="true"
            className={styles.missionDialog}
            role="dialog"
          >
            <header className={styles.dialogHeader}>
              <div>
                <p className={styles.panelEyebrow}>{selectedMission.type}</p>
                <h2 id="mission-dialog-title">{selectedMission.title}</h2>
              </div>
              <button
                aria-label="Close mission details"
                className={styles.closeButton}
                onClick={() => setSelectedMission(null)}
                type="button"
              >
                x
              </button>
            </header>

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
          </section>
        </div>
      ) : null}

      {selectedSkill ? (
        <div
          className={styles.modalBackdrop}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedSkill(null);
            }
          }}
        >
          <section
            aria-labelledby="skill-dialog-title"
            aria-modal="true"
            className={styles.missionDialog}
            role="dialog"
          >
            <header className={styles.dialogHeader}>
              <div>
                <p className={styles.panelEyebrow}>Skill</p>
                <h2 id="skill-dialog-title">{selectedSkill.name}</h2>
              </div>
              <button
                aria-label="Close skill details"
                className={styles.closeButton}
                onClick={() => setSelectedSkill(null)}
                type="button"
              >
                x
              </button>
            </header>

            <section className={styles.factsBlock}>
              <h3>Training Activities</h3>
              <div className={styles.activityList}>
                {selectedSkill.activities.map((activity) => (
                  <div className={styles.activityItem} key={`${activity.level}-${activity.name}`}>
                    <span>Level {activity.level}</span>
                    <strong>{activity.name}</strong>
                    <span>{activity.xp} XP</span>
                  </div>
                ))}
              </div>
            </section>
          </section>
        </div>
      ) : null}
    </main>
  );
}
