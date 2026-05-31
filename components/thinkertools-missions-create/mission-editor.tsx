"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import { apiFetch, isApiRequestError } from "@/components/quipx/client";
import type { ContentDraft, ValidationIssue } from "@/lib/authoring/draft-types";

import { DraftSourceBadge } from "./draft-source-badge";

// ─── Types ────────────────────────────────────────────────────────────────────

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

function prettyJson(value: unknown): string {
  if (value === null || value === undefined) return "";
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function tryParseJson(raw: string): unknown {
  const t = raw.trim();
  if (!t) return undefined;
  try { return JSON.parse(t); } catch { return undefined; }
}

type MissionBodyRaw = Record<string, unknown>;

function toMissionBodyRaw(body: unknown): MissionBodyRaw {
  const b = (body ?? {}) as Record<string, unknown>;
  return {
    narrative_hook: b.narrative_hook ?? "",
    short_description: b.short_description ?? "",
    difficulty_label: b.difficulty_label ?? "",
    required_training_level: b.required_training_level ?? 1,
    xp_reward: b.xp_reward ?? 0,
    stages: b.stages ?? [],
    actions: b.actions ?? [],
    facts: b.facts ?? [],
    character_claims: b.character_claims ?? [],
    contradiction_review: b.contradiction_review ?? {},
    resolution_options: b.resolution_options ?? [],
    resolution_review: b.resolution_review ?? {},
    debrief: b.debrief ?? {},
  };
}

function summariseMission(raw: MissionBodyRaw): string {
  const hook = typeof raw.narrative_hook === "string" ? raw.narrative_hook : "";
  if (!hook) return "No content yet.";
  const stages = Array.isArray(raw.stages) ? raw.stages.length : 0;
  const claims = Array.isArray(raw.character_claims) ? raw.character_claims.length : 0;
  return `${stages} stage${stages !== 1 ? "s" : ""} · ${claims} claim${claims !== 1 ? "s" : ""}`;
}

let msgCounter = 0;
function nextId() { msgCounter += 1; return `msg-${msgCounter}`; }

function JsonField({
  label, value, onChange, disabled, rows = 6, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  disabled: boolean; rows?: number; hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-600">
      <span className="font-medium">
        {label}
        {hint ? <span className="ml-1 font-normal text-slate-400">{hint}</span> : null}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={rows}
        spellCheck={false}
        className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 focus:border-slate-400 focus:bg-white focus:outline-none disabled:opacity-60"
      />
    </label>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MissionEditor({ draft, onDraftChange, fromMessage }: Props) {
  const draftId = draft.id;

  // ── View toggle ─────────────────────────────────────────────────────────
  const [view, setView] = useState<ViewMode>("chat");

  // ── Shared draft (kept in sync) ─────────────────────────────────────────
  const [currentDraft, setCurrentDraft] = useState(draft);
  const raw = toMissionBodyRaw(currentDraft.body);

  // ── Chat state ──────────────────────────────────────────────────────────
  const initialRaw = toMissionBodyRaw(draft.body);
  const hasExistingContent = !!(typeof initialRaw.narrative_hook === "string" && initialRaw.narrative_hook.trim());

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const msgs: ChatMessage[] = [];
    if (fromMessage) {
      msgs.push({ id: nextId(), role: "user", text: fromMessage });
    }
    msgs.push({
      id: nextId(),
      role: "assistant",
      text: hasExistingContent
        ? "I've drafted a mission based on your description. You can see the structure in the preview card below. Keep chatting to refine it, or switch to the Form tab to edit any field directly."
        : "Hi! Describe the mission you want to create — the scenario, how many stages, what the contradiction is about. I'll draft the full structure for you.",
    });
    return msgs;
  });
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // ── Form state ──────────────────────────────────────────────────────────
  const [title, setTitle] = useState(currentDraft.title);
  const [narrativeHook, setNarrativeHook] = useState(
    typeof raw.narrative_hook === "string" ? raw.narrative_hook : "",
  );
  const [shortDescription, setShortDescription] = useState(
    typeof raw.short_description === "string" ? raw.short_description : "",
  );
  const [difficultyLabel, setDifficultyLabel] = useState(
    typeof raw.difficulty_label === "string" ? raw.difficulty_label : "",
  );
  const [requiredTrainingLevel, setRequiredTrainingLevel] = useState(
    typeof raw.required_training_level === "number" ? String(raw.required_training_level) : "1",
  );
  const [xpReward, setXpReward] = useState(
    typeof raw.xp_reward === "number" ? String(raw.xp_reward) : "0",
  );
  const [stagesJson, setStagesJson] = useState(prettyJson(raw.stages));
  const [actionsJson, setActionsJson] = useState(prettyJson(raw.actions));
  const [factsJson, setFactsJson] = useState(prettyJson(raw.facts));
  const [claimsJson, setClaimsJson] = useState(prettyJson(raw.character_claims));
  const [contradictionReviewJson, setContradictionReviewJson] = useState(prettyJson(raw.contradiction_review));
  const [resolutionOptionsJson, setResolutionOptionsJson] = useState(prettyJson(raw.resolution_options));
  const [resolutionReviewJson, setResolutionReviewJson] = useState(prettyJson(raw.resolution_review));
  const [debriefJson, setDebriefJson] = useState(prettyJson(raw.debrief));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── Publish state ────────────────────────────────────────────────────────
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(
    draft.status === "published" && draft.slug ? draft.slug : null,
  );

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function syncFormFromDraft(updated: ContentDraft) {
    const r = toMissionBodyRaw(updated.body);
    setCurrentDraft(updated);
    setTitle(updated.title);
    setNarrativeHook(typeof r.narrative_hook === "string" ? r.narrative_hook : "");
    setShortDescription(typeof r.short_description === "string" ? r.short_description : "");
    setDifficultyLabel(typeof r.difficulty_label === "string" ? r.difficulty_label : "");
    setRequiredTrainingLevel(typeof r.required_training_level === "number" ? String(r.required_training_level) : "1");
    setXpReward(typeof r.xp_reward === "number" ? String(r.xp_reward) : "0");
    setStagesJson(prettyJson(r.stages));
    setActionsJson(prettyJson(r.actions));
    setFactsJson(prettyJson(r.facts));
    setClaimsJson(prettyJson(r.character_claims));
    setContradictionReviewJson(prettyJson(r.contradiction_review));
    setResolutionOptionsJson(prettyJson(r.resolution_options));
    setResolutionReviewJson(prettyJson(r.resolution_review));
    setDebriefJson(prettyJson(r.debrief));
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

    const hasContent = typeof raw.narrative_hook === "string" && raw.narrative_hook.trim();

    try {
      let result: { draft: ContentDraft };

      if (!hasContent) {
        result = await apiFetch<{ draft: ContentDraft }>(
          `/api/thinkertools-missions-create/drafts/${draftId}/generate`,
          { method: "POST", body: JSON.stringify({ description: text }) },
        );
        const r2 = toMissionBodyRaw(result.draft.body);
        const summary = summariseMission(r2);
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            text: `Done! I've drafted a mission: ${summary}. Switch to the Form tab to review the full structure, or keep chatting to refine it.`,
          },
        ]);
      } else {
        result = await apiFetch<{ draft: ContentDraft }>(
          `/api/thinkertools-missions-create/drafts/${draftId}/refine`,
          { method: "POST", body: JSON.stringify({ instruction: text }) },
        );
        const r2 = toMissionBodyRaw(result.draft.body);
        const summary = summariseMission(r2);
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
  function buildBody(): Record<string, unknown> {
    return {
      narrative_hook: narrativeHook,
      short_description: shortDescription,
      difficulty_label: difficultyLabel,
      required_training_level: parseInt(requiredTrainingLevel, 10) || 1,
      xp_reward: parseInt(xpReward, 10) || 0,
      stages: tryParseJson(stagesJson) ?? [],
      actions: tryParseJson(actionsJson) ?? [],
      facts: tryParseJson(factsJson) ?? [],
      character_claims: tryParseJson(claimsJson) ?? [],
      contradiction_review: tryParseJson(contradictionReviewJson) ?? {},
      resolution_options: tryParseJson(resolutionOptionsJson) ?? [],
      resolution_review: tryParseJson(resolutionReviewJson) ?? {},
      debrief: tryParseJson(debriefJson) ?? {},
    };
  }

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const result = await apiFetch<{ draft: ContentDraft }>(
        `/api/thinkertools-missions-create/drafts/${draftId}`,
        { method: "PATCH", body: JSON.stringify({ title: title.trim() || undefined, body: buildBody() }) },
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
        publishedMission: { id: string; slug: string };
      }>(`/api/thinkertools-missions-create/drafts/${draftId}/publish`, { method: "POST" });
      setPublishedSlug(result.publishedMission?.slug ?? null);
      syncFormFromDraft(result.draft);
    } catch (err) {
      setPublishError(isApiRequestError(err) ? err.message : "Publish failed.");
    } finally {
      setPublishing(false);
    }
  }

  const validationIssues: ValidationIssue[] = Array.isArray(currentDraft.validationIssues)
    ? currentDraft.validationIssues : [];

  const hasContent = typeof raw.narrative_hook === "string" && raw.narrative_hook.trim();

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[currentDraft.status]}`}>
            {STATUS_LABELS[currentDraft.status]}
          </span>
          <DraftSourceBadge aiSource={currentDraft.aiSource} />
          {validationIssues.length > 0 ? (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-600">
              {validationIssues.length} issue{validationIssues.length !== 1 ? "s" : ""}
            </span>
          ) : null}
        </div>

        <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          <button
            type="button"
            onClick={() => setView("chat")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${view === "chat" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            AI Chat
          </button>
          <button
            type="button"
            onClick={() => setView("form")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${view === "form" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Form
          </button>
        </div>

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
        </div>
      </div>

      {publishedSlug ? (
        <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-2 text-xs text-emerald-700">
          Published as <span className="font-mono font-semibold">{publishedSlug}</span>
        </div>
      ) : null}
      {publishError ? (
        <div className="border-b border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-700">
          {publishError}
        </div>
      ) : null}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* AI CHAT PLANE                                                      */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {view === "chat" ? (
        <div className="flex flex-col" style={{ minHeight: "520px" }}>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.role === "user" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-800"}`}>
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

          {/* Live preview card */}
          {hasContent ? (
            <div className="mx-4 mb-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Current draft</p>
              {typeof raw.narrative_hook === "string" && raw.narrative_hook ? (
                <p className="text-sm font-medium text-slate-800">{raw.narrative_hook}</p>
              ) : null}
              {typeof raw.short_description === "string" && raw.short_description ? (
                <p className="mt-1 text-xs text-slate-500">{raw.short_description}</p>
              ) : null}
              <p className="mt-1.5 text-xs text-slate-400">{summariseMission(raw)}</p>
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

          <form onSubmit={handleChatSubmit} className="border-t border-slate-100 px-4 py-3 flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={chatBusy}
              placeholder={
                hasContent
                  ? "Refine: add a stage, change the setting, make the contradiction harder…"
                  : "Describe the mission scenario you want to create…"
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
          {chatError ? <p className="px-4 pb-3 text-xs text-rose-600">{chatError}</p> : null}
        </div>
      ) : null}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* FORM PLANE                                                         */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {view === "form" ? (
        <form onSubmit={handleSave} className="space-y-4 px-5 py-5">
          <p className="text-xs text-slate-400">Fields stay in sync with the AI chat. Saving here updates the draft.</p>

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
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} disabled={saving} maxLength={300} placeholder="Untitled"
              className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none disabled:opacity-60" />
          </label>

          <label className="flex flex-col gap-1 text-xs text-slate-600">
            <span className="font-medium">Narrative hook</span>
            <textarea value={narrativeHook} onChange={(e) => setNarrativeHook(e.target.value)} disabled={saving} rows={3} maxLength={600}
              placeholder="The opening hook…"
              className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none disabled:opacity-60" />
          </label>

          <label className="flex flex-col gap-1 text-xs text-slate-600">
            <span className="font-medium">Short description</span>
            <input type="text" value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} disabled={saving} maxLength={300}
              placeholder="One-sentence summary…"
              className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none disabled:opacity-60" />
          </label>

          <label className="flex flex-col gap-1 text-xs text-slate-600">
            <span className="font-medium">Difficulty label</span>
            <input type="text" value={difficultyLabel} onChange={(e) => setDifficultyLabel(e.target.value)} disabled={saving} maxLength={60}
              placeholder="e.g. Beginner"
              className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none disabled:opacity-60" />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-xs text-slate-600">
              <span className="font-medium">Required level <span className="font-normal text-slate-400">(1–20)</span></span>
              <input type="number" value={requiredTrainingLevel} onChange={(e) => setRequiredTrainingLevel(e.target.value)} disabled={saving} min={1} max={20}
                className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 focus:border-slate-400 focus:bg-white focus:outline-none disabled:opacity-60" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-600">
              <span className="font-medium">XP reward</span>
              <input type="number" value={xpReward} onChange={(e) => setXpReward(e.target.value)} disabled={saving} min={0}
                className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 focus:border-slate-400 focus:bg-white focus:outline-none disabled:opacity-60" />
            </label>
          </div>

          <div className="space-y-4 border-t border-slate-100 pt-4">
            <p className="text-[11px] text-slate-400">Complex fields — edit as JSON.</p>
            <JsonField label="Stages" hint="(array)" value={stagesJson} onChange={setStagesJson} disabled={saving} rows={8} />
            <JsonField label="Actions" hint="(array)" value={actionsJson} onChange={setActionsJson} disabled={saving} rows={8} />
            <JsonField label="Facts" hint="(array)" value={factsJson} onChange={setFactsJson} disabled={saving} rows={5} />
            <JsonField label="Character claims" hint="(array)" value={claimsJson} onChange={setClaimsJson} disabled={saving} rows={8} />
            <JsonField label="Contradiction review" hint="(object)" value={contradictionReviewJson} onChange={setContradictionReviewJson} disabled={saving} rows={8} />
            <JsonField label="Resolution options" hint="(array)" value={resolutionOptionsJson} onChange={setResolutionOptionsJson} disabled={saving} rows={8} />
            <JsonField label="Resolution review" hint="(object)" value={resolutionReviewJson} onChange={setResolutionReviewJson} disabled={saving} rows={6} />
            <JsonField label="Debrief" hint="(object)" value={debriefJson} onChange={setDebriefJson} disabled={saving} rows={6} />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={saving}
              className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">
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
