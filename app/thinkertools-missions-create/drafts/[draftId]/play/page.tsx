"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

import { apiFetch, isApiRequestError } from "@/components/quipx/client";
import type { ContentDraft } from "@/lib/authoring/draft-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RoundPromptClaim = {
  label: string;
  text: string;
  displayText: string;
};

type PreviewSubmitResponse = {
  wasCorrect: boolean;
  selectedLabels: string[];
  correctAnswerLabels: string[];
  explanation: string;
};

type DraftResponse = {
  draft: ContentDraft;
};

// ---------------------------------------------------------------------------
// Helpers — parse the draft body into the fields the UI needs
// ---------------------------------------------------------------------------

function parseActivityBody(body: unknown): {
  questionText: string;
  promptClaims: RoundPromptClaim[];
  expectedAnswerCount: 1 | 2;
} | null {
  if (typeof body !== "object" || body === null) return null;

  const b = body as Record<string, unknown>;

  const questionText =
    typeof b.question_text === "string" && b.question_text.trim()
      ? b.question_text.trim()
      : "Which claims are in strongest contradiction?";

  const rawClaims = Array.isArray(b.prompt_claims) ? b.prompt_claims : [];
  const promptClaims: RoundPromptClaim[] = [];
  const seenLabels = new Set<string>();

  for (let i = 0; i < rawClaims.length; i++) {
    const raw = rawClaims[i];
    if (typeof raw !== "string" || !raw.trim()) continue;

    const matched = raw.trim().match(/^([A-Za-z0-9]+)\s*[.):-]\s*(.+)$/);
    const fallbackLabel = String.fromCharCode(65 + i);
    const rawLabel = matched ? matched[1].trim().toUpperCase() : fallbackLabel;
    const labelMatch = rawLabel.match(/[A-Z0-9]+/);
    const label = labelMatch ? labelMatch[0] : fallbackLabel;
    const text = matched ? matched[2].trim() : raw.trim();

    if (!label || !text || seenLabels.has(label)) continue;
    seenLabels.add(label);
    promptClaims.push({ label, text, displayText: `${label}. ${text}` });
  }

  if (promptClaims.length < 2) return null;

  const rawCount = b.expected_answer_count;
  const expectedAnswerCount: 1 | 2 = rawCount === 1 ? 1 : 2;

  return { questionText, promptClaims, expectedAnswerCount };
}

// ---------------------------------------------------------------------------
// Mission body types (minimal — just what the preview needs)
// ---------------------------------------------------------------------------

type MissionStagePreview = {
  id: string;
  title: string;
  objective: string;
};

type MissionClaimPreview = {
  id: string;
  label: string;
  character_name: string;
  role: string;
  statement: string;
};

type MissionPreviewData = {
  narrativeHook: string;
  shortDescription: string;
  difficultyLabel: string;
  requiredTrainingLevel: number;
  xpReward: number;
  stages: MissionStagePreview[];
  claims: MissionClaimPreview[];
};

function parseMissionBody(body: unknown): MissionPreviewData | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;

  const narrativeHook =
    typeof b.narrative_hook === "string" ? b.narrative_hook.trim() : "";
  const shortDescription =
    typeof b.short_description === "string" ? b.short_description.trim() : "";
  const difficultyLabel =
    typeof b.difficulty_label === "string" ? b.difficulty_label.trim() : "";
  const requiredTrainingLevel =
    typeof b.required_training_level === "number" ? b.required_training_level : 1;
  const xpReward =
    typeof b.xp_reward === "number" ? b.xp_reward : 0;

  const rawStages = Array.isArray(b.stages) ? b.stages : [];
  const stages: MissionStagePreview[] = rawStages
    .filter(
      (s): s is Record<string, unknown> =>
        typeof s === "object" && s !== null,
    )
    .map((s) => ({
      id: typeof s.id === "string" ? s.id : "",
      title: typeof s.title === "string" ? s.title : "",
      objective: typeof s.objective === "string" ? s.objective : "",
    }))
    .filter((s) => s.id && s.title);

  const rawClaims = Array.isArray(b.character_claims) ? b.character_claims : [];
  const claims: MissionClaimPreview[] = rawClaims
    .filter(
      (c): c is Record<string, unknown> =>
        typeof c === "object" && c !== null,
    )
    .map((c) => ({
      id: typeof c.id === "string" ? c.id : "",
      label: typeof c.label === "string" ? c.label : "",
      character_name: typeof c.character_name === "string" ? c.character_name : "",
      role: typeof c.role === "string" ? c.role : "",
      statement: typeof c.statement === "string" ? c.statement : "",
    }))
    .filter((c) => c.id && c.label);

  if (!narrativeHook || stages.length < 2 || claims.length < 2) return null;

  return {
    narrativeHook,
    shortDescription,
    difficultyLabel,
    requiredTrainingLevel,
    xpReward,
    stages,
    claims,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DraftPlayPage({
  params,
}: {
  params: Promise<{ draftId: string }>;
}) {
  const { draftId } = use(params);

  const [loadState, setLoadState] = useState<
    "loading" | "error" | "not_found" | "forbidden" | "ready"
  >("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ContentDraft | null>(null);

  // Activity-specific parsed fields
  const [questionText, setQuestionText] = useState("");
  const [promptClaims, setPromptClaims] = useState<RoundPromptClaim[]>([]);
  const [expectedAnswerCount, setExpectedAnswerCount] = useState<1 | 2>(2);

  // Mission-specific parsed fields
  const [missionPreview, setMissionPreview] = useState<MissionPreviewData | null>(null);

  // Activity interaction state
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [recoverableError, setRecoverableError] = useState<string | null>(null);
  const [result, setResult] = useState<PreviewSubmitResponse | null>(null);

  // Load the draft
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoadState("loading");
      setLoadError(null);

      try {
        const response = await apiFetch<DraftResponse>(
          `/api/thinkertools-missions-create/drafts/${draftId}`,
        );
        if (!mounted) return;

        const loadedDraft = response.draft;

        if (loadedDraft.contentType === "mission") {
          const parsed = parseMissionBody(loadedDraft.body);
          if (!parsed) {
            setLoadState("error");
            setLoadError(
              "This draft does not have a valid mission body to preview.",
            );
            return;
          }
          setDraft(loadedDraft);
          setMissionPreview(parsed);
          setLoadState("ready");
        } else {
          const parsed = parseActivityBody(loadedDraft.body);
          if (!parsed) {
            setLoadState("error");
            setLoadError(
              "This draft does not have a valid activity body to preview.",
            );
            return;
          }
          setDraft(loadedDraft);
          setQuestionText(parsed.questionText);
          setPromptClaims(parsed.promptClaims);
          setExpectedAnswerCount(parsed.expectedAnswerCount);
          setLoadState("ready");
        }
      } catch (err) {
        if (!mounted) return;

        if (isApiRequestError(err)) {
          if (err.status === 403) {
            setLoadState("forbidden");
          } else if (err.status === 404) {
            setLoadState("not_found");
          } else {
            setLoadState("error");
            setLoadError(err.message);
          }
        } else {
          setLoadState("error");
          setLoadError("Failed to load draft.");
        }
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [draftId]);

  const onToggleLabel = (label: string) => {
    if (result) return;
    setRecoverableError(null);

    setSelectedLabels((current) => {
      if (current.includes(label)) {
        return current.filter((l) => l !== label);
      }
      if (current.length < expectedAnswerCount) {
        return [...current, label];
      }
      if (expectedAnswerCount === 1) {
        return [label];
      }
      // pick-two: replace the oldest selection
      return [current[1], label];
    });
  };

  const onSubmit = async () => {
    if (submitting || result) return;

    setSubmitting(true);
    setSubmitError(null);
    setRecoverableError(null);

    try {
      const response = await apiFetch<PreviewSubmitResponse>(
        `/api/thinkertools-missions-create/drafts/${draftId}/preview-submit`,
        {
          method: "POST",
          body: JSON.stringify({
            selectedLabels,
            typedAnswer: typedAnswer.trim() || undefined,
          }),
        },
      );
      setResult(response);
    } catch (err) {
      if (isApiRequestError(err)) {
        const isRecoverable =
          err.status === 422 && err.code?.startsWith("MISSIONS_");
        if (isRecoverable) {
          setRecoverableError(err.message);
        } else {
          setSubmitError(err.message);
        }
      } else {
        setSubmitError("Failed to submit answer.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onReplay = () => {
    setSelectedLabels([]);
    setTypedAnswer("");
    setResult(null);
    setSubmitError(null);
    setRecoverableError(null);
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const editorHref = `/thinkertools-missions-create/drafts/${draftId}`;

  if (loadState === "loading") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center text-sm text-emerald-800">
        Loading draft preview…
      </div>
    );
  }

  if (loadState === "not_found") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-sm text-rose-700">Draft not found.</p>
        <Link
          href="/thinkertools-missions-create"
          className="mt-4 inline-block text-sm text-emerald-700 underline"
        >
          ← Back to drafts
        </Link>
      </div>
    );
  }

  if (loadState === "forbidden") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-sm text-rose-700">
          You do not have permission to preview this draft.
        </p>
        <Link
          href="/thinkertools-missions-create"
          className="mt-4 inline-block text-sm text-emerald-700 underline"
        >
          ← Back to drafts
        </Link>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-sm text-rose-700">{loadError ?? "Failed to load draft."}</p>
        <Link
          href={editorHref}
          className="mt-4 inline-block text-sm text-emerald-700 underline"
        >
          ← Back to editor
        </Link>
      </div>
    );
  }

  // loadState === "ready"

  // ── Mission preview ─────────────────────────────────────────────────────────
  if (draft?.contentType === "mission" && missionPreview) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        {/* Preview banner */}
        <div className="mb-6 flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Preview mode
            </p>
            <p className="mt-0.5 text-sm text-amber-900">
              No XP awarded — this is a draft preview only.
            </p>
          </div>
          <Link
            href={editorHref}
            className="ml-4 shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
          >
            ← Back to editor
          </Link>
        </div>

        {/* Mission card */}
        <section className="overflow-hidden rounded-2xl border border-emerald-300 bg-white shadow-sm">
          {/* Header */}
          <div className="border-b border-emerald-100 bg-emerald-50 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
              Mission — Draft
            </p>
            {draft.title ? (
              <p className="mt-1 text-base font-semibold text-emerald-950">
                {draft.title}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              {missionPreview.difficultyLabel ? (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                  {missionPreview.difficultyLabel}
                </span>
              ) : null}
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                Level {missionPreview.requiredTrainingLevel}+
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                {missionPreview.xpReward} XP
              </span>
            </div>
          </div>

          <div className="space-y-6 px-5 py-5">
            {/* Narrative hook */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                Narrative hook
              </p>
              <p className="mt-1 text-sm text-emerald-950">
                {missionPreview.narrativeHook}
              </p>
            </div>

            {/* Short description */}
            {missionPreview.shortDescription ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                  Description
                </p>
                <p className="mt-1 text-sm text-emerald-900">
                  {missionPreview.shortDescription}
                </p>
              </div>
            ) : null}

            {/* Stages */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                Stages ({missionPreview.stages.length})
              </p>
              <ol className="mt-2 space-y-2">
                {missionPreview.stages.map((stage, idx) => (
                  <li
                    key={stage.id}
                    className="flex gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-200 text-[10px] font-bold text-emerald-800">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-emerald-950">
                        {stage.title}
                      </p>
                      <p className="mt-0.5 text-xs text-emerald-700">
                        {stage.objective}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Character claims */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                Character claims ({missionPreview.claims.length})
              </p>
              <ul className="mt-2 space-y-2">
                {missionPreview.claims.map((claim) => (
                  <li
                    key={claim.id}
                    className="rounded-xl border border-emerald-100 bg-white px-4 py-3"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                        {claim.label}
                      </span>
                      <span className="text-sm font-medium text-emerald-950">
                        {claim.character_name}
                      </span>
                      <span className="text-xs text-emerald-600">{claim.role}</span>
                    </div>
                    <p className="mt-1.5 text-sm text-emerald-900">
                      &ldquo;{claim.statement}&rdquo;
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Preview note */}
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              This is a structural preview. The full interactive mission flow (stage
              navigation, contradiction review, resolution choice, and debrief) is
              available after publishing.
            </p>
          </div>
        </section>
      </div>
    );
  }

  // ── Activity preview ────────────────────────────────────────────────────────
  const canSubmit =
    !result &&
    !submitting &&
    selectedLabels.length === expectedAnswerCount;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      {/* Preview banner */}
      <div className="mb-6 flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Preview mode
          </p>
          <p className="mt-0.5 text-sm text-amber-900">
            No XP awarded — this is a draft preview only.
          </p>
        </div>
        <Link
          href={editorHref}
          className="ml-4 shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
        >
          ← Back to editor
        </Link>
      </div>

      {/* Activity card */}
      <section className="overflow-hidden rounded-2xl border border-emerald-300 bg-white shadow-sm">
        {/* Header */}
        <div className="border-b border-emerald-100 bg-emerald-50 px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
            Contradiction Spotting — Draft
          </p>
          {draft?.title ? (
            <p className="mt-1 text-base font-semibold text-emerald-950">
              {draft.title}
            </p>
          ) : null}
        </div>

        <div className="px-5 py-5">
          {/* Question */}
          <p className="text-sm font-medium text-emerald-950">{questionText}</p>
          <p className="mt-1 text-xs text-emerald-700">
            {expectedAnswerCount === 1
              ? "Select the one claim that is the key contradiction."
              : `Select the ${expectedAnswerCount} claims that are in strongest contradiction.`}
          </p>

          {/* Claims */}
          <ul className="mt-4 space-y-2">
            {promptClaims.map((claim) => {
              const isSelected = selectedLabels.includes(claim.label);
              const isCorrect =
                result?.correctAnswerLabels.includes(claim.label) ?? false;
              const isWrongPick =
                result !== null && isSelected && !isCorrect;

              let claimClass =
                "w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors";

              if (result) {
                if (isCorrect) {
                  claimClass +=
                    " border-green-400 bg-green-50 text-green-900";
                } else if (isWrongPick) {
                  claimClass +=
                    " border-rose-300 bg-rose-50 text-rose-900";
                } else {
                  claimClass +=
                    " border-emerald-200 bg-white text-emerald-900 opacity-60";
                }
              } else if (isSelected) {
                claimClass +=
                  " border-emerald-600 bg-emerald-50 text-emerald-950 font-medium";
              } else {
                claimClass +=
                  " border-emerald-200 bg-white text-emerald-900 hover:border-emerald-400 hover:bg-emerald-50/60 cursor-pointer";
              }

              return (
                <li key={claim.label}>
                  <button
                    type="button"
                    className={claimClass}
                    onClick={() => onToggleLabel(claim.label)}
                    disabled={!!result}
                    aria-pressed={isSelected}
                  >
                    {claim.displayText}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Typed answer input (optional — mirrors the real drill) */}
          {!result ? (
            <div className="mt-4">
              <input
                type="text"
                value={typedAnswer}
                onChange={(e) => {
                  setTypedAnswer(e.target.value);
                  setRecoverableError(null);
                }}
                placeholder={`Or type your answer (e.g. "A and C")`}
                className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-emerald-950 placeholder:text-emerald-400 focus:border-emerald-500 focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void onSubmit();
                }}
              />
            </div>
          ) : null}

          {/* Recoverable / submit errors */}
          {recoverableError ? (
            <p className="mt-3 text-sm text-amber-700">{recoverableError}</p>
          ) : null}
          {submitError ? (
            <p className="mt-3 text-sm text-rose-700">{submitError}</p>
          ) : null}

          {/* Submit / result */}
          {!result ? (
            <button
              type="button"
              onClick={() => void onSubmit()}
              disabled={!canSubmit}
              className="mt-5 w-full rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Checking…" : "Submit answer"}
            </button>
          ) : (
            <div className="mt-5 space-y-3">
              {/* Outcome banner */}
              <div
                className={`rounded-xl border px-4 py-3 ${
                  result.wasCorrect
                    ? "border-green-300 bg-green-50"
                    : "border-rose-200 bg-rose-50"
                }`}
              >
                <p
                  className={`text-sm font-semibold ${
                    result.wasCorrect ? "text-green-800" : "text-rose-800"
                  }`}
                >
                  {result.wasCorrect ? "✓ Correct!" : "✗ Not quite."}
                </p>
                <p className="mt-1 text-sm text-emerald-900">
                  {result.explanation}
                </p>
                <p className="mt-2 text-xs text-emerald-700">
                  Correct answer:{" "}
                  <span className="font-medium">
                    {result.correctAnswerLabels.join(" + ")}
                  </span>
                </p>
                <p className="mt-1 text-xs font-medium text-amber-700">
                  Preview mode — no XP awarded.
                </p>
              </div>

              {/* Replay */}
              <button
                type="button"
                onClick={onReplay}
                className="w-full rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-medium text-emerald-800 hover:bg-emerald-50"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
