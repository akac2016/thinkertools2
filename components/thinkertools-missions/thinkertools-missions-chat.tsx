"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import styles from "./thinkertools-missions-chat.module.css";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  name: string;
  body: string;
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
      </div>
    </main>
  );
}
