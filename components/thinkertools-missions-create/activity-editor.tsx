"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import { apiFetch, isApiRequestError } from "@/components/quipx/client";
import type { ContentDraft, ValidationIssue } from "@/lib/authoring/draft-types";

import { DraftSourceBadge } from "./draft-source-badge";

// ─── Types ────────────────────────────────────────────────────────────────────

type ActivityBody = {
  round_type?: string;
  question_text: string;
  prompt_claims: string[];
  correct_answer_labels: string[];
  explanation: string;
  expected_answer_count: 1 | 2;
};

type Props = {
  draft: ContentDraft;
  onDraftChange: (updated: ContentDraft) => void;
  fromMessage?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type ViewMode = "chat" | "form";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toActivityBody(body: unknown): ActivityBody {
  const b = (body ?? {}) as Record<string, unknown>;
  return {
    round_type: typeof b.round_type === "string" ? b.round_type : "activity_standard",
    question_text: typeof b.question_text === "string" ? b.question_text : "",
    prompt_claims: Array.isArray(b.prompt_claims) ? (b.prompt_claims as string[]) : [],
    correct_answer_labels: Array.isArray(b.correct_answer_labels)
      ? (b.correct_answer_labels as string[])
      : [],
    explanation: typeof b.explanation === "string" ? b.explanation : "",
    expected_answer_count:
      b.expected_answer_count === 1 || b.expected_answer_count === 2
        ? b.expected_answer_count
        : 2,
  };
}

function summariseDraft(body: ActivityBody): string {
  if (!body.question_text && body.prompt_claims.length === 0) {
    return "No content yet.";
  }
  const claimCount = body.prompt_claims.length;
  const answerCount = body.expected_answer_count;
  const labels = body.correct_answer_labels.join(" + ") || "—";
  return `${claimCount} claim${claimCount !== 1 ? "s" : ""} · correct: ${labels} · expects ${answerCount} answer${answerCount !== 1 ? "s" : ""}`;
}

const STATUS_STYLES: Record<ContentDraft["status"], string> = {
  draft: "bg-slate-100 text-slate-600",
  valid: "bg-emerald-100 text-emerald-700",
  published: "bg-blue-100 text-blue-700",
  archived: "bg-rose-100 text-rose-600",
};
const STATUS_LABELS: Record<ContentDraft["status"], string> = {
  draft: "Draft",
  valid: "Valid",
  published: "Published",
  archived: "Archived",
};

let msgCounter = 0;
function nextId() {
  msgCounter += 1;
  return `msg-${msgCounter}`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ActivityEditor({ draft, onDraftChange, fromMessage }: Props) {
  const draftId = draft.id;

  // ── View toggle ─────────────────────────────────────────────────────────
  const [view, setView] = useState<ViewMode>("chat");

  // ── Shared draft body (kept in sync between both planes) ────────────────
  const [currentDraft, setCurrentDraft] = useState(draft);
  const body = toActivityBody(currentDraft.body);

  // ── Chat state ──────────────────────────────────────────────────────────
  const initialBody = toActivityBody(draft.body);
  const hasExistingContent = !!(initialBody.question_text || initialBody.prompt_claims.length > 0);

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const msgs: ChatMessage[] = [];
    if (fromMessage) {
      msgs.push({ id: nextId(), role: "user", text: fromMessage });
    }
    msgs.push({
      id: nextId(),
      role: "assistant",
      text: hasExistingContent
        ? "I've put together a practice question based on your description. You can see it in the preview card below. Keep chatting to refine it, or switch to the Form tab to edit any field directly."
        : "Describe what you want learners to practice — a topic, a concept, a scenario. I'll put together a practice question for you.",
    });
    return msgs;
  });
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // ── Form state (synced from draft body) ─────────────────────────────────
  const [title, setTitle] = useState(currentDraft.title);
  const [questionText, setQuestionText] = useState(body.question_text);
  const [promptClaimsRaw, setPromptClaimsRaw] = useState(body.prompt_claims.join("\n"));
  const [correctAnswerLabels, setCorrectAnswerLabels] = useState(
    body.correct_answer_labels.join(", "),
  );
  const [explanation, setExplanation] = useState(body.explanation);
  const [expectedAnswerCount, setExpectedAnswerCount] = useState<1 | 2>(
    body.expected_answer_count,
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── Publish state ────────────────────────────────────────────────────────
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(
    draft.status === "published" && draft.slug ? draft.slug : null,
  );

  // ── Release (Go Live) state ──────────────────────────────────────────────
  const [releasing, setReleasing] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);

  // ── Scroll chat to bottom on new messages ───────────────────────────────
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Sync form fields whenever the draft body changes ────────────────────
  function syncFormFromDraft(updated: ContentDraft) {
    const b = toActivityBody(updated.body);
    setCurrentDraft(updated);
    setTitle(updated.title);
    setQuestionText(b.question_text);
    setPromptClaimsRaw(b.prompt_claims.join("\n"));
    setCorrectAnswerLabels(b.correct_answer_labels.join(", "));
    setExplanation(b.explanation);
    setExpectedAnswerCount(b.expected_answer_count);
    onDraftChange(updated);
  }

  // ── Chat submit ──────────────────────────────────────────────────────────
  async function handleChatSubmit(e: FormEvent) {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || chatBusy) return;

    setChatInput("");
    setChatError(null);
    setMessages((prev) => [...prev, { id: nextId(), role: "user", text }]);
    setChatBusy(true);

    const hasDraftContent =
      body.question_text || body.prompt_claims.length > 0;

    try {
      let result: { draft: ContentDraft };

      if (!hasDraftContent) {
        // First message — generate from scratch
        result = await apiFetch<{ draft: ContentDraft }>(
          `/api/thinkertools-missions-create/drafts/${draftId}/generate`,
          { method: "POST", body: JSON.stringify({ description: text }) },
        );
        const b2 = toActivityBody(result.draft.body);
        const summary = summariseDraft(b2);
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            text: `Done! I've drafted an activity: ${summary}. Switch to the Form tab to review every field, or keep chatting to refine it.`,
          },
        ]);
      } else {
        // Subsequent messages — refine
        result = await apiFetch<{ draft: ContentDraft }>(
          `/api/thinkertools-missions-create/drafts/${draftId}/refine`,
          { method: "POST", body: JSON.stringify({ instruction: text }) },
        );
        const b2 = toActivityBody(result.draft.body);
        const summary = summariseDraft(b2);
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            text: `Updated. ${summary}. Anything else to change?`,
          },
        ]);
      }

      syncFormFromDraft(result.draft);
    } catch (err) {
      const msg = isApiRequestError(err) ? err.message : "Something went wrong.";
      setChatError(msg);
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", text: `Sorry — ${msg}` },
      ]);
    } finally {
      setChatBusy(false);
    }
  }

  // ── Form save ────────────────────────────────────────────────────────────
  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const promptClaims = promptClaimsRaw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const correctLabels = correctAnswerLabels
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const result = await apiFetch<{ draft: ContentDraft }>(
        `/api/thinkertools-missions-create/drafts/${draftId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title: title.trim() || undefined,
            body: {
              round_type: "activity_standard",
              question_text: questionText,
              prompt_claims: promptClaims,
              correct_answer_labels: correctLabels,
              explanation,
              expected_answer_count: expectedAnswerCount,
            },
          }),
        },
      );
      syncFormFromDraft(result.draft);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      setSaveError(isApiRequestError(err) ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  // ── Publish ──────────────────────────────────────────────────────────────
  async function handlePublish() {
    setPublishing(true);
    setPublishError(null);
    try {
      const result = await apiFetch<{
        draft: ContentDraft;
        publishedActivity: { id: string; slug: string };
      }>(`/api/thinkertools-missions-create/drafts/${draftId}/publish`, {
        method: "POST",
      });
      setPublishedSlug(result.publishedActivity.slug);
      syncFormFromDraft(result.draft);
    } catch (err) {
      setPublishError(isApiRequestError(err) ? err.message : "Publish failed.");
    } finally {
      setPublishing(false);
    }
  }

  // ── Release (Go Live) ────────────────────────────────────────────────────
  async function handleRelease() {
    setReleasing(true);
    setReleaseError(null);
    try {
      await apiFetch(
        `/api/thinkertools-missions-create/drafts/${draftId}/release`,
        { method: "POST" },
      );
      setIsLive(true);
    } catch (err) {
      setReleaseError(isApiRequestError(err) ? err.message : "Failed to go live.");
    } finally {
      setReleasing(false);
    }
  }

  const validationIssues: ValidationIssue[] = Array.isArray(currentDraft.validationIssues)
    ? currentDraft.validationIssues
    : [];

  const hasDraftContent = body.question_text || body.prompt_claims.length > 0;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        {/* Left: status + source */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[currentDraft.status]}`}
          >
            {STATUS_LABELS[currentDraft.status]}
          </span>
          <DraftSourceBadge aiSource={currentDraft.aiSource} />
          {validationIssues.length > 0 ? (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-600">
              {validationIssues.length} issue{validationIssues.length !== 1 ? "s" : ""}
            </span>
          ) : null}
        </div>

        {/* Centre: view toggle */}
        <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          <button
            type="button"
            onClick={() => setView("chat")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              view === "chat"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            AI Chat
          </button>
          <button
            type="button"
            onClick={() => setView("form")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              view === "form"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Form
          </button>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          <a
            href={`/thinkertools-missions-create/drafts/${draftId}/play`}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Preview
          </a>
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing || currentDraft.status !== "valid"}
            className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-40"
          >
            {publishing ? "Publishing…" : "Publish"}
          </button>
          {currentDraft.status === "published" && publishedSlug && !isLive ? (
            <button
              type="button"
              onClick={handleRelease}
              disabled={releasing}
              className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600 disabled:opacity-40"
            >
              {releasing ? "Going Live…" : "Go Live"}
            </button>
          ) : null}
        </div>
      </div>

      {/* ── Publish success / error banners ──────────────────────────────── */}
      {publishedSlug && !isLive ? (
        <div className="border-b border-blue-100 bg-blue-50 px-4 py-2 text-xs text-blue-700">
          Published as <span className="font-mono font-semibold">{publishedSlug}</span>
          {" · "}
          <span className="font-medium">Status: Pending</span>
          {" · "}
          Click "Go Live" to make it visible to players
        </div>
      ) : null}
      {isLive ? (
        <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-2 text-xs text-emerald-700">
          <span className="font-mono font-semibold">{publishedSlug}</span>
          {" · "}
          <span className="font-medium">Status: Live</span>
          {" · "}
          Now visible to players
        </div>
      ) : null}
      {publishError ? (
        <div className="border-b border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-700">
          {publishError}
        </div>
      ) : null}
      {releaseError ? (
        <div className="border-b border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-700">
          {releaseError}
        </div>
      ) : null}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* AI CHAT PLANE                                                      */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {view === "chat" ? (
        <div className="flex flex-col" style={{ minHeight: "520px" }}>

          {/* Message list */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-800"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {chatBusy ? (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-slate-100 px-4 py-2.5 text-sm text-slate-400">
                  <span className="inline-flex gap-1">
                    <span className="animate-bounce" style={{ animationDelay: "0ms" }}>·</span>
                    <span className="animate-bounce" style={{ animationDelay: "150ms" }}>·</span>
                    <span className="animate-bounce" style={{ animationDelay: "300ms" }}>·</span>
                  </span>
                </div>
              </div>
            ) : null}
            <div ref={chatBottomRef} />
          </div>

          {/* Live draft preview card — only shown once there's content */}
          {hasDraftContent ? (
            <div className="mx-4 mb-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Current draft
              </p>
              {body.question_text ? (
                <p className="text-sm font-medium text-slate-800">{body.question_text}</p>
              ) : null}
              {body.prompt_claims.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {body.prompt_claims.map((claim, i) => (
                    <li key={i} className="text-xs text-slate-600">{claim}</li>
                  ))}
                </ul>
              ) : null}
              {body.correct_answer_labels.length > 0 ? (
                <p className="mt-2 text-xs text-slate-500">
                  Correct: <span className="font-medium text-emerald-700">{body.correct_answer_labels.join(" + ")}</span>
                </p>
              ) : null}
              {validationIssues.length > 0 ? (
                <ul className="mt-2 space-y-0.5">
                  {validationIssues.map((issue, i) => (
                    <li key={i} className="text-[11px] text-rose-600">
                      {issue.path ? `${issue.path}: ` : ""}{issue.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {/* Chat input */}
          <form
            onSubmit={handleChatSubmit}
            className="border-t border-slate-100 px-4 py-3 flex gap-2"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={chatBusy}
              placeholder={
                hasDraftContent
                  ? "Refine: make it harder, add a claim, change the topic…"
                  : "Describe what you want learners to practice…"
              }
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={chatBusy || !chatInput.trim()}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
            >
              {chatBusy ? "…" : "Send"}
            </button>
          </form>
          {chatError ? (
            <p className="px-4 pb-3 text-xs text-rose-600">{chatError}</p>
          ) : null}
        </div>
      ) : null}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* FORM PLANE                                                         */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {view === "form" ? (
        <form onSubmit={handleSave} className="space-y-4 px-5 py-5">
          <p className="text-xs text-slate-400">
            Fields stay in sync with the AI chat. Saving here updates the draft.
          </p>

          {/* Validation issues */}
          {validationIssues.length > 0 ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="mb-1.5 text-xs font-semibold text-rose-700">Validation issues</p>
              <ul className="space-y-1">
                {validationIssues.map((issue, i) => (
                  <li key={i} className="text-xs text-rose-700">
                    {issue.path ? <span className="font-medium">{issue.path}: </span> : null}
                    {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <label className="flex flex-col gap-1 text-xs text-slate-600">
            <span className="font-medium">Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={saving}
              maxLength={300}
              placeholder="Untitled"
              className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none disabled:opacity-60"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-slate-600">
            <span className="font-medium">Question text</span>
            <input
              type="text"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              disabled={saving}
              maxLength={300}
              placeholder="What should learners identify or evaluate?"
              className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none disabled:opacity-60"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-slate-600">
            <span className="font-medium">
              Claims <span className="font-normal text-slate-400">(one per line)</span>
            </span>
            <textarea
              value={promptClaimsRaw}
              onChange={(e) => setPromptClaimsRaw(e.target.value)}
              disabled={saving}
              rows={5}
              placeholder={"A: Claim one\nB: Claim two\nC: Claim three"}
              className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none disabled:opacity-60"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-slate-600">
            <span className="font-medium">
              Correct labels <span className="font-normal text-slate-400">(comma-separated, e.g. A, C)</span>
            </span>
            <input
              type="text"
              value={correctAnswerLabels}
              onChange={(e) => setCorrectAnswerLabels(e.target.value)}
              disabled={saving}
              placeholder="A, C"
              className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none disabled:opacity-60"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-slate-600">
            <span className="font-medium">Explanation</span>
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              disabled={saving}
              rows={3}
              maxLength={600}
              placeholder="Why is that the correct answer?"
              className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none disabled:opacity-60"
            />
          </label>

          <fieldset className="flex flex-col gap-1 text-xs text-slate-600">
            <legend className="font-medium">Expected answers</legend>
            <div className="mt-1 flex gap-4">
              {([1, 2] as const).map((n) => (
                <label key={n} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="expected_answer_count"
                    value={n}
                    checked={expectedAnswerCount === n}
                    onChange={() => setExpectedAnswerCount(n)}
                    disabled={saving}
                    className="accent-slate-700"
                  />
                  {n === 1 ? "1 — single" : "2 — pair"}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {saveSuccess ? <span className="text-xs text-emerald-600">Saved.</span> : null}
            {saveError ? <span className="text-xs text-rose-700">{saveError}</span> : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
