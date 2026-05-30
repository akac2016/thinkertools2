"use client";

import { type ReactNode, useMemo, useState } from "react";

import styles from "./mission-control.module.css";

type MissionMode = "feed" | "drill" | "quest";
type DrillPhase = "selecting" | "submitted";

type ProgressState = {
  skill: string;
  level: number;
  currentXp: number;
  nextLevelXp: number;
  totalXp: number;
};

type Assignment = {
  id: string;
  label: string;
  title: string;
  detail: string;
  reward: number;
  status: "recommended" | "available" | "new" | "locked";
};

type FeedMessage = {
  id: string;
  type: "system" | "decision" | "reward" | "scene" | "character";
  speaker: string;
  body: string;
  side?: "system" | "user";
};

const progress: ProgressState = {
  skill: "Philosophical Reasoning",
  level: 3,
  currentXp: 340,
  nextLevelXp: 500,
  totalXp: 1340,
};

const contradictionDrills: Assignment[] = [
  {
    id: "cd-017",
    label: "CD-017",
    title: "Contradiction Spotting: Intake Claims",
    detail: "Compact pair selection. Recommended difficulty. Calibrated for current level.",
    reward: 80,
    status: "recommended",
  },
  {
    id: "cd-021",
    label: "CD-021",
    title: "Contradiction Spotting: Advanced Review",
    detail: "Harder available content. Higher reward authorized.",
    reward: 130,
    status: "new",
  },
  {
    id: "cd-032",
    label: "CD-032",
    title: "Contradiction Spotting: Locked Escalation",
    detail: "Requires level 4 clearance.",
    reward: 160,
    status: "locked",
  },
];

const feedMessages: FeedMessage[] = [
  {
    id: "feed-1",
    type: "system",
    speaker: "TEMPORAL ASSIGNMENT SYSTEM",
    body: "Philosophical Reasoning track remains active. Assignment queue has been recompiled from available competence evidence.",
  },
  {
    id: "feed-2",
    type: "reward",
    speaker: "PROGRESSION NOTICE",
    body: "Level 3 access confirmed. Higher-XP contradiction work is now visible to this terminal.",
  },
  {
    id: "feed-3",
    type: "decision",
    speaker: "RECOMMENDED ROUTE",
    body: "Proceed to CD-017. The system requires one compact contradiction selection before additional case routing becomes statistically defensible.",
  },
];

const drillClaims = [
  {
    label: "A",
    text: "The archive states that no applicant may join a mission without prior temporal clearance.",
  },
  {
    label: "B",
    text: "The intake officer says Mirel was assigned after clearance was waived for routine maintenance cases.",
  },
  {
    label: "C",
    text: "The mission log classifies Mirel's placement as a recruitment decision, not maintenance work.",
  },
];

const questFacts = [
  "Mirel appears in the recruit ledger without a normal authorization chain.",
  "Two offices classify the same assignment under different administrative reasons.",
  "The case was routed to this terminal before user consent was requested.",
];

function getProgressPercent(state: ProgressState) {
  return Math.round((state.currentXp / state.nextLevelXp) * 100);
}

function statusLabel(status: Assignment["status"]) {
  if (status === "new") {
    return "NEW";
  }

  if (status === "recommended") {
    return "RECOMMENDED";
  }

  if (status === "locked") {
    return "LOCKED";
  }

  return "AVAILABLE";
}

function Message({
  message,
  children,
}: {
  message: FeedMessage;
  children?: ReactNode;
}) {
  return (
    <article
      className={`${styles.messageRow} ${
        message.side === "user" ? styles.userRow : styles.systemRow
      }`}
    >
      <div className={`${styles.message} ${styles[message.type]}`}>
      <div className={styles.messageHeader}>
        <span>{message.speaker}</span>
        <span>{message.type.toUpperCase()}</span>
      </div>
      <p>{message.body}</p>
      {children ? <div className={styles.messageActions}>{children}</div> : null}
      </div>
    </article>
  );
}

function ProgressStrip({ compact = false }: { compact?: boolean }) {
  const percent = getProgressPercent(progress);

  return (
    <section className={compact ? styles.progressCompact : styles.progressBlock}>
      <div className={styles.panelHeader}>
        <span>SKILL STATE</span>
        <span>ACTIVE</span>
      </div>
      <div className={styles.skillTitle}>{progress.skill}</div>
      <div className={styles.progressMeta}>
        <span>LEVEL {progress.level}</span>
        <span>{progress.currentXp}/{progress.nextLevelXp} XP</span>
      </div>
      <div className={styles.progressTrack} aria-label={`${percent}% XP progress`}>
        <div className={styles.progressFill} style={{ width: `${percent}%` }} />
      </div>
      {!compact ? (
        <p className={styles.panelNote}>
          Advancement threshold monitored. Additional routing will unlock after sufficient evidence.
        </p>
      ) : null}
    </section>
  );
}

function AssignmentCard({
  assignment,
  onStart,
}: {
  assignment: Assignment;
  onStart?: () => void;
}) {
  const isLocked = assignment.status === "locked";

  return (
    <button
      className={`${styles.chatOption} ${styles[assignment.status]}`}
      disabled={isLocked}
      onClick={onStart}
      type="button"
    >
      <span className={styles.optionCode}>{assignment.label}</span>
      <span className={styles.optionBody}>
        <strong>{assignment.title}</strong>
        <span>{assignment.detail}</span>
      </span>
      <span className={styles.optionMeta}>
        {statusLabel(assignment.status)} / +{assignment.reward} XP
      </span>
    </button>
  );
}

function FeedState({ setMode }: { setMode: (mode: MissionMode) => void }) {
  return (
    <>
      {feedMessages.map((message) => (
        <Message key={message.id} message={message}>
          {message.id === "feed-3" ? (
            <>
              <button className={styles.primaryButton} onClick={() => setMode("drill")}>
                Start Recommended Assignment
              </button>
              <button className={styles.secondaryButton} onClick={() => setMode("quest")}>
                Inspect Quest Routing
              </button>
            </>
          ) : null}
        </Message>
      ))}

      <Message
        message={{
          id: "feed-drills",
          type: "decision",
          speaker: "ASSIGNMENT QUEUE",
          body: "Available contradiction drills are listed below. Select one route. Locked routes remain visible for progression context only.",
        }}
      >
        <div className={styles.optionStack}>
          {contradictionDrills.map((assignment) => (
            <AssignmentCard
              key={assignment.id}
              assignment={assignment}
              onStart={assignment.status === "locked" ? undefined : () => setMode("drill")}
            />
          ))}
        </div>
      </Message>

      <Message
        message={{
          id: "feed-quest",
          type: "system",
          speaker: "QUEST ROUTING",
          body: "WR-001, The Wrong Recruit, is available. A live intake case has been routed to this terminal. Assignment legitimacy requires review.",
        }}
      >
        <button className={styles.secondaryButton} onClick={() => setMode("quest")}>
          Open Case
        </button>
      </Message>
    </>
  );
}

function DrillState() {
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [phase, setPhase] = useState<DrillPhase>("selecting");
  const selectedKey = selectedLabels.slice().sort().join("");
  const isCorrect = selectedKey === "AC";

  function toggleClaim(label: string) {
    if (phase === "submitted") {
      return;
    }

    setSelectedLabels((current) => {
      if (current.includes(label)) {
        return current.filter((item) => item !== label);
      }

      if (current.length >= 2) {
        return [current[1], label];
      }

      return [...current, label];
    });
  }

  function resetRound() {
    setSelectedLabels([]);
    setPhase("selecting");
  }

  return (
    <>
      <Message
        message={{
          id: "drill-user",
          type: "decision",
          speaker: "YOU",
          body: "/start-cd-017",
          side: "user",
        }}
      />
      <Message
        message={{
          id: "drill-route",
          type: "system",
          speaker: "ROUTING CONTROL",
          body: "Contradiction drill CD-017 attached. Select the two claims with the strongest conflict. Free-form elaboration is not required.",
        }}
      />

      <Message
        message={{
          id: "drill-prompt",
          type: "decision",
          speaker: "ACTIVE REASONING TASK",
          body: "Review the claims below. Choose exactly two labels.",
        }}
      >
        <div className={styles.claimList}>
          {drillClaims.map((claim) => {
            const selected = selectedLabels.includes(claim.label);
            return (
              <button
                key={claim.label}
                className={`${styles.claimButton} ${selected ? styles.claimSelected : ""}`}
                onClick={() => toggleClaim(claim.label)}
                type="button"
              >
                <span>{claim.label}</span>
                <span>{claim.text}</span>
              </button>
            );
          })}
        </div>
        <button
          className={styles.primaryButton}
          disabled={selectedLabels.length !== 2 || phase === "submitted"}
          onClick={() => setPhase("submitted")}
        >
          Submit Pair
        </button>
      </Message>

      {phase === "submitted" ? (
        <>
          <Message
            message={{
              id: "drill-player",
              type: "decision",
              speaker: "YOU",
              body: `Selected claims ${selectedLabels.slice().sort().join(" and ")}.`,
              side: "user",
            }}
          />
          <Message
            message={{
              id: "drill-result",
              type: isCorrect ? "reward" : "system",
              speaker: isCorrect ? "RESULT CONFIRMED" : "RESULT REVIEW",
              body: isCorrect
                ? "Strongest contradiction identified. Claim A blocks uncleared recruits. Claim C says the placement was recruitment. The waiver in B only applies to maintenance."
                : "Selection recorded. Strongest available conflict is A and C. The maintenance waiver does not resolve a recruitment placement.",
            }}
          >
            <div className={styles.rewardLine}>
              <span>{isCorrect ? "+80 XP" : "+20 XP REVIEW CREDIT"}</span>
              <span>Philosophical Reasoning</span>
            </div>
            <button className={styles.secondaryButton} onClick={resetRound}>
              Run Another Drill
            </button>
          </Message>
        </>
      ) : null}
    </>
  );
}

function QuestState({ setMode }: { setMode: (mode: MissionMode) => void }) {
  return (
    <>
      <Message
        message={{
          id: "quest-user",
          type: "decision",
          speaker: "YOU",
          body: "/open-wr-001",
          side: "user",
        }}
      />
      <Message
        message={{
          id: "quest-system",
          type: "system",
          speaker: "MISROUTED CASE INTAKE",
          body: "The Wrong Recruit has been attached to this terminal. Consent sequence was bypassed by urgency scoring. The system has elected to proceed.",
        }}
      />
      <Message
        message={{
          id: "quest-scene",
          type: "scene",
          speaker: "CASE DESCRIPTION",
          body: "A recruitment office, a maintenance bureau, and a mission archive have each filed incompatible versions of the same assignment.",
        }}
      />
      <Message
        message={{
          id: "quest-character",
          type: "character",
          speaker: "RECORDED TESTIMONY: INTAKE OFFICER",
          body: "Mirel was not recruited. Mirel was routed as maintenance support. That distinction is why clearance was not required.",
        }}
      />
      <Message
        message={{
          id: "quest-decision",
          type: "decision",
          speaker: "STAGE 1 OBJECTIVE",
          body: "Case intake stage active. Inspect the brief, review facts, then identify which testimony should enter contradiction review.",
        }}
      >
        <button className={styles.primaryButton}>Inspect Brief</button>
        <button className={styles.secondaryButton}>Review Facts</button>
        <button className={styles.secondaryButton} onClick={() => setMode("feed")}>
          Hold Case
        </button>
      </Message>
    </>
  );
}

function CommandDock({
  mode,
  setMode,
}: {
  mode: MissionMode;
  setMode: (mode: MissionMode) => void;
}) {
  const promptText =
    mode === "feed"
      ? "awaiting route selection"
      : mode === "drill"
        ? "contradiction pair required"
        : "case intake pending brief inspection";

  return (
    <footer className={styles.commandDock}>
      <div className={styles.commandPrompt}>
        <span>&gt;</span>
        <strong>{promptText}</strong>
      </div>
      <div className={styles.commandActions} aria-label="Available chat commands">
        <button
          className={mode === "feed" ? styles.commandActive : ""}
          onClick={() => setMode("feed")}
          type="button"
        >
          /queue
        </button>
        <button
          className={mode === "drill" ? styles.commandActive : ""}
          onClick={() => setMode("drill")}
          type="button"
        >
          /start-cd-017
        </button>
        <button
          className={mode === "quest" ? styles.commandActive : ""}
          onClick={() => setMode("quest")}
          type="button"
        >
          /open-wr-001
        </button>
      </div>
    </footer>
  );
}

function StatePanel({ mode }: { mode: MissionMode }) {
  const activeAssignment = useMemo(() => {
    if (mode === "quest") {
      return {
        label: "WR-001",
        title: "The Wrong Recruit",
        stage: "Intake attached",
        objective: "Inspect case facts before contradiction review.",
      };
    }

    if (mode === "drill") {
      return {
        label: "CD-017",
        title: "Contradiction Spotting",
        stage: "Pair selection",
        objective: "Choose the strongest conflicting claims.",
      };
    }

    return {
      label: "QUEUE",
      title: "Assignment Feed",
      stage: "Awaiting route",
      objective: "Start the recommended contradiction assignment.",
    };
  }, [mode]);

  return (
    <aside className={styles.statePanel}>
      <ProgressStrip compact={mode === "quest"} />

      <section className={styles.panelBlock}>
        <div className={styles.panelHeader}>
          <span>CURRENT ROUTE</span>
          <span>{activeAssignment.label}</span>
        </div>
        <h2>{activeAssignment.title}</h2>
        <dl className={styles.stateList}>
          <div>
            <dt>Stage</dt>
            <dd>{activeAssignment.stage}</dd>
          </div>
          <div>
            <dt>Objective</dt>
            <dd>{activeAssignment.objective}</dd>
          </div>
        </dl>
      </section>

      {mode === "quest" ? (
        <section className={styles.panelBlock}>
          <div className={styles.panelHeader}>
            <span>CASE FACTS</span>
            <span>LIVE</span>
          </div>
          <ul className={styles.factList}>
            {questFacts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </section>
      ) : (
        <section className={styles.panelBlock}>
          <div className={styles.panelHeader}>
            <span>NEXT ACCESS</span>
            <span>VISIBLE</span>
          </div>
          <ul className={styles.factList}>
            <li>Harder contradiction assignment visible at current level.</li>
            <li>Quest route available after one compact drill.</li>
            <li>Additional reasoning tracks remain sealed.</li>
          </ul>
        </section>
      )}
    </aside>
  );
}

export function MissionControlClient() {
  const [mode, setMode] = useState<MissionMode>("feed");

  return (
    <main className={styles.pageShell}>
      <div className={styles.scanline} />
      <header className={styles.topBar}>
        <div>
          <p className={styles.eyebrow}>TEMPORAL ASSIGNMENT SYSTEM</p>
          <h1>ThinkerTools Chat</h1>
        </div>
        <div className={styles.statusCluster} aria-label="System status">
          <span>SESSION: TT-MISSION-003</span>
          <span>ROUTE: ACTIVE</span>
          <span>QUEUE: STABLE</span>
        </div>
      </header>

      <section className={styles.commandFrame}>
        <div className={styles.shellGrid}>
          <section className={styles.chatPane} aria-label="Assignment chat feed">
            <div className={styles.chatHeader}>
              <div>
                <span>PRIMARY FEED</span>
                <strong>
                  {mode === "feed"
                    ? "Assignment feed"
                    : mode === "drill"
                      ? "Active contradiction drill"
                      : "The Wrong Recruit"}
                </strong>
              </div>
              <span className={styles.liveSignal}>ACTIVE</span>
            </div>
            <div className={styles.feedStack}>
              {mode === "feed" ? <FeedState setMode={setMode} /> : null}
              {mode === "drill" ? <DrillState /> : null}
              {mode === "quest" ? <QuestState setMode={setMode} /> : null}
            </div>
            <CommandDock mode={mode} setMode={setMode} />
          </section>

          <StatePanel mode={mode} />
        </div>
      </section>
    </main>
  );
}
