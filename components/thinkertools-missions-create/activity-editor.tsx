"use client";

import { useRouter } from "next/navigation";
import { FormEvent, type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";

import { apiFetch, isApiRequestError } from "@/components/quipx/client";
import { deriveActivityAuthoringState } from "@/lib/authoring/activity-authoring-state";
import type { ContentDraft, ValidationIssue } from "@/lib/authoring/draft-types";
import { extractPastedQuestionBatch } from "@/lib/authoring/question-batch";

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
  isTransient?: boolean;
  onDraftCreated?: (created: ContentDraft) => void;
  fromMessage?: string;
  activityGroups?: ActivityGroupOption[];
  loadingActivityGroups?: boolean;
  activityGroupsError?: string | null;
  onActivityGroupCreated?: (group: ActivityGroupOption) => void;
};

export type ActivityGroupOption = {
  id: string;
  title: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

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

function hasActivityBodyContent(body: ActivityBody): boolean {
  return Boolean(body.question_text || body.prompt_claims.length > 0);
}

function isAdditiveQuestionRequest(input: string): boolean {
  const normalized = input.toLowerCase().trim();
  if (!normalized) return false;
  if (!normalized.includes("question")) return false;

  const additiveMarkers = [
    "more question",
    "another question",
    "new question",
    "additional question",
    "add question",
    "generate question",
    "create question",
    "give me",
  ];

  if (additiveMarkers.some((marker) => normalized.includes(marker))) return true;
  return /\b\d+\s+more\b/.test(normalized);
}

function isYesResponse(input: string): boolean {
  return /^(?:yes|y|yeah|yep|same group|they do|all together)[.!]?$/i.test(input.trim());
}

function isNoResponse(input: string): boolean {
  return /^(?:no|n|nope|different groups|separate them|they do not|they don't)[.!]?$/i.test(
    input.trim(),
  );
}

function requestedAdditionalQuestionCount(input: string): number {
  const normalized = input.toLowerCase();
  const explicit = normalized.match(/\b(\d+)\s+(?:more|new|additional)?\s*questions?\b/);
  if (explicit) {
    const parsed = Number.parseInt(explicit[1], 10);
    if (Number.isFinite(parsed) && parsed > 0) return Math.min(parsed, 10);
  }
  if (/\banother\b/.test(normalized)) return 1;
  return 1;
}

function buildAdditionalQuestionDescription(
  base: ActivityBody,
  instruction: string,
  trainingTitle: string | null | undefined,
  activityGroupTitle: string | null | undefined,
): string {
  const scope = activityGroupTitle || trainingTitle || "this topic";
  const compactClaims = base.prompt_claims.slice(0, 4).join(" | ");
  const genericIntent = /^(let'?s\s+)?(please\s+)?(generate|create|add|give)\s+(me\s+)?((\d+\s+)?more|another|additional)\s+questions?[\.\!\?]*$/i
    .test(instruction.trim());
  const extraGuidance = genericIntent ? "" : `\nAdditional guidance from educator: ${instruction.trim()}`;
  const raw = [
    `Create one NEW practice question for ${scope}.`,
    "It must not duplicate the previous question.",
    `Previous question: ${base.question_text || "(none provided)"}`,
    `Previous claims: ${compactClaims || "(none provided)"}`,
    "Keep the same skill level and same general biology context unless extra guidance says otherwise.",
    extraGuidance,
  ].filter(Boolean).join("\n");
  return raw.length > 1800 ? `${raw.slice(0, 1797)}...` : raw;
}

const STATUS_STYLES: Record<ContentDraft["status"], string> = {
  draft: "bg-slate-100 text-slate-600",
  valid: "bg-emerald-100 text-emerald-700",
  published: "bg-blue-100 text-blue-700",
  archived: "bg-rose-100 text-rose-600",
};
const STATUS_LABELS: Record<ContentDraft["status"], string> = {
  draft: "Draft",
  valid: "Ready to publish",
  published: "Published",
  archived: "Archived",
};
const STATUS_DESCRIPTIONS: Record<ContentDraft["status"], string> = {
  draft: "Still being edited or missing information needed to publish.",
  valid: "Complete and ready to publish. Players cannot see it until it goes live.",
  published: "A pending or live activity has been created from this draft.",
  archived: "Retired and no longer active.",
};

function BadgeTooltip({ children, description }: { children: ReactNode; description: string }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-64 rounded-lg bg-slate-900 px-3 py-2 text-left text-xs leading-5 text-white opacity-0 shadow-lg transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {description}
      </span>
    </span>
  );
}

let msgCounter = 0;
function nextId() {
  msgCounter += 1;
  return `msg-${msgCounter}`;
}

function sortQuestionDrafts(drafts: ContentDraft[]): ContentDraft[] {
  return [...drafts].sort((a, b) => {
    const createdDelta = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (createdDelta !== 0) return createdDelta;
    return a.id.localeCompare(b.id);
  });
}

function upsertQuestionDraft(drafts: ContentDraft[], draft: ContentDraft): ContentDraft[] {
  const byId = new Map(drafts.map((item) => [item.id, item]));
  byId.set(draft.id, draft);
  return sortQuestionDrafts(Array.from(byId.values()));
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ActivityEditor({
  draft,
  onDraftChange,
  isTransient = false,
  onDraftCreated,
  fromMessage,
  activityGroups = [],
  loadingActivityGroups = false,
  activityGroupsError = null,
  onActivityGroupCreated,
}: Props) {
  const router = useRouter();

  // ── Shared draft body (kept in sync between both planes) ────────────────
  const [currentDraft, setCurrentDraft] = useState(draft);
  const [questionDrafts, setQuestionDrafts] = useState<ContentDraft[]>([draft]);
  const body = toActivityBody(currentDraft.body);
  const draftId = currentDraft.id;
  const authoringState = deriveActivityAuthoringState({
    subjectTrainingId: currentDraft.primaryTrainingId,
    selectedContentType: currentDraft.contentType,
    hasDraft: true,
    activityGroupId: currentDraft.activityGroupId,
    draftStatus: currentDraft.status,
  });

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
        ? "I've put together a practice question based on your description. You can see it in the preview card below. Keep chatting to refine it, or edit any field directly in the manual form."
        : draft.activityGroupTitle
          ? `You're adding a new question to “${draft.activityGroupTitle}.” Describe what you want learners to practice, and I'll help you draft it.`
          : "Describe what you want learners to practice — a topic, a concept, a scenario. I'll put together a practice question for you.",
    });
    return msgs;
  });
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [pendingQuestionBatch, setPendingQuestionBatch] = useState<{
    questions: string[];
    confirmed: boolean;
  } | null>(null);
  const [lastGenerationContext, setLastGenerationContext] = useState<ActivityBody>(initialBody);
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
  const [hasRequestedValidation, setHasRequestedValidation] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── Activity group assignment state ─────────────────────────────────────
  const [selectedActivityGroupId, setSelectedActivityGroupId] = useState("");
  const [newActivityGroupTitle, setNewActivityGroupTitle] = useState("");
  const [assigningActivityGroup, setAssigningActivityGroup] = useState(false);
  const [activityGroupAssignmentError, setActivityGroupAssignmentError] = useState<string | null>(null);

  // ── Publish state ────────────────────────────────────────────────────────
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishMenuOpen, setPublishMenuOpen] = useState(false);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(
    draft.status === "published" && draft.slug ? draft.slug : null,
  );

  // ── Release (Go Live) state ──────────────────────────────────────────────
  const [releasing, setReleasing] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(draft.publishedActivityStatus === "live");

  // ── Scroll chat to bottom on new messages ───────────────────────────────
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    let mounted = true;

    async function loadQuestionDrafts() {
      if (isTransient) {
        setQuestionDrafts([draft]);
        return;
      }

      if (!draft.activityGroupId) {
        setQuestionDrafts((prev) => upsertQuestionDraft(prev, draft));
        return;
      }

      try {
        const result = await apiFetch<{ drafts: ContentDraft[] }>(
          "/api/thinkertools-missions-create/drafts",
        );
        if (!mounted) return;

        const siblings = result.drafts.filter(
          (item) =>
            item.contentType === "activity" &&
            item.activityGroupId === draft.activityGroupId,
        );
        setQuestionDrafts(upsertQuestionDraft(siblings, draft));
      } catch {
        if (mounted) setQuestionDrafts((prev) => upsertQuestionDraft(prev, draft));
      }
    }

    void loadQuestionDrafts();
    return () => {
      mounted = false;
    };
  }, [draft, isTransient]);

  // ── Sync form fields whenever the draft body changes ────────────────────
  function syncFormFromDraft(updated: ContentDraft) {
    const mergedDraft: ContentDraft = {
      ...updated,
      trainingTitle: updated.trainingTitle ?? currentDraft.trainingTitle ?? null,
      activityGroupTitle: Object.prototype.hasOwnProperty.call(updated, "activityGroupTitle")
        ? updated.activityGroupTitle ?? null
        : currentDraft.activityGroupTitle ?? null,
      publishedActivityStatus: Object.prototype.hasOwnProperty.call(updated, "publishedActivityStatus")
        ? updated.publishedActivityStatus ?? null
        : currentDraft.publishedActivityStatus ?? null,
    };
    const b = toActivityBody(updated.body);
    setCurrentDraft(mergedDraft);
    setTitle(mergedDraft.title);
    setQuestionText(b.question_text);
    setPromptClaimsRaw(b.prompt_claims.join("\n"));
    setCorrectAnswerLabels(b.correct_answer_labels.join(", "));
    setExplanation(b.explanation);
    setExpectedAnswerCount(b.expected_answer_count);
    setLastGenerationContext(b);
    setPublishedSlug(mergedDraft.status === "published" && mergedDraft.slug ? mergedDraft.slug : null);
    setIsLive(mergedDraft.publishedActivityStatus === "live");
    setQuestionDrafts((prev) => upsertQuestionDraft(prev, mergedDraft));
    onDraftChange(mergedDraft);
  }

  function selectQuestionDraft(nextDraft: ContentDraft) {
    setSaveError(null);
    setSaveSuccess(false);
    setPublishError(null);
    setReleaseError(null);
    setHasRequestedValidation(false);
    syncFormFromDraft(nextDraft);
  }

  async function assignActivityGroup(activityGroupId: string | null) {
    const result = await apiFetch<{ draft: ContentDraft }>(
      `/api/thinkertools-missions-create/drafts/${draftId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ activityGroupId }),
      },
    );
    syncFormFromDraft(result.draft);
    setSelectedActivityGroupId("");
    setNewActivityGroupTitle("");
  }

  async function handleRemoveActivityGroup() {
    if (!currentDraft.activityGroupId || assigningActivityGroup || isLive) return;

    setAssigningActivityGroup(true);
    setActivityGroupAssignmentError(null);
    try {
      await assignActivityGroup(null);
    } catch (err) {
      setActivityGroupAssignmentError(
        isApiRequestError(err) ? err.message : "Failed to remove activity group.",
      );
    } finally {
      setAssigningActivityGroup(false);
    }
  }

  async function handleExistingActivityGroupAssignment() {
    if (!selectedActivityGroupId || assigningActivityGroup) return;

    setAssigningActivityGroup(true);
    setActivityGroupAssignmentError(null);
    try {
      await assignActivityGroup(selectedActivityGroupId);
    } catch (err) {
      setActivityGroupAssignmentError(
        isApiRequestError(err) ? err.message : "Failed to assign activity group.",
      );
    } finally {
      setAssigningActivityGroup(false);
    }
  }

  async function handleCreateAndAssignActivityGroup() {
    const groupTitle = newActivityGroupTitle.trim();
    if (!groupTitle || assigningActivityGroup) return;

    setAssigningActivityGroup(true);
    setActivityGroupAssignmentError(null);
    try {
      const result = await apiFetch<{ group: ActivityGroupOption }>(
        "/api/thinkertools-missions-create/activity-groups",
        {
          method: "POST",
          body: JSON.stringify({
            trainingId: currentDraft.primaryTrainingId,
            title: groupTitle,
          }),
        },
      );
      onActivityGroupCreated?.(result.group);
      await assignActivityGroup(result.group.id);
    } catch (err) {
      setActivityGroupAssignmentError(
        isApiRequestError(err) ? err.message : "Failed to create and assign activity group.",
      );
    } finally {
      setAssigningActivityGroup(false);
    }
  }

  async function createPastedQuestionBatch() {
    if (
      !pendingQuestionBatch?.confirmed
      || !currentDraft.activityGroupId
      || chatBusy
    ) {
      return;
    }

    setChatBusy(true);
    setChatError(null);
    try {
      const generatedDrafts: ContentDraft[] = [];
      for (const question of pendingQuestionBatch.questions) {
        const created = await apiFetch<{ draft: ContentDraft }>(
          "/api/thinkertools-missions-create/drafts",
          {
            method: "POST",
            body: JSON.stringify({
              contentType: "activity",
              primaryTrainingId: currentDraft.primaryTrainingId,
              activityGroupId: currentDraft.activityGroupId,
              title: currentDraft.title || undefined,
            }),
          },
        );
        const generated = await apiFetch<{ draft: ContentDraft }>(
          `/api/thinkertools-missions-create/drafts/${created.draft.id}/generate`,
          {
            method: "POST",
            body: JSON.stringify({
              description: `Build one activity from this teacher-provided question while preserving its intent: ${question}`,
            }),
          },
        );
        generatedDrafts.push(generated.draft);
      }

      setQuestionDrafts((prev) => {
        let next = prev;
        for (const generated of generatedDrafts) {
          next = upsertQuestionDraft(next, generated);
        }
        return next;
      });
      const firstDraft = generatedDrafts[0];
      if (firstDraft) {
        syncFormFromDraft(firstDraft);
        if (isTransient) onDraftCreated?.(firstDraft);
      }
      setPendingQuestionBatch(null);
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          text: `Created ${generatedDrafts.length} separate questions in “${currentDraft.activityGroupTitle ?? "the confirmed activity group"}.”`,
        },
      ]);
    } catch (error) {
      setChatError(
        isApiRequestError(error) ? error.message : "Failed to create the question batch.",
      );
    } finally {
      setChatBusy(false);
    }
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

    if (pendingQuestionBatch && !pendingQuestionBatch.confirmed) {
      if (isYesResponse(text)) {
        setPendingQuestionBatch({ ...pendingQuestionBatch, confirmed: true });
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            text: currentDraft.activityGroupId
              ? "Confirmed. Review the activity group below, then create the batch."
              : "Confirmed. Assign or create one activity group for this draft, then create the batch.",
          },
        ]);
      } else if (isNoResponse(text)) {
        setPendingQuestionBatch(null);
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            text: "Nothing was saved. Split the questions into intentional sets and add each set to its chosen activity group.",
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            text: "Please reply yes if every pasted question belongs in this activity group, or no if they should be separated.",
          },
        ]);
      }
      setChatBusy(false);
      return;
    }

    const hasDraftContent = hasActivityBodyContent(body);
    const isAdditionalQuestionRequest = hasDraftContent && isAdditiveQuestionRequest(text);
    const pastedQuestions = extractPastedQuestionBatch(text);

    if (pastedQuestions) {
      if (pastedQuestions.length > 10) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            text: `I found ${pastedQuestions.length} questions. Split this into batches of 10 or fewer so each set can be reviewed and assigned intentionally. Nothing was saved.`,
          },
        ]);
      } else {
        setPendingQuestionBatch({ questions: pastedQuestions, confirmed: false });
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            text: `I found ${pastedQuestions.length} separate questions. Do they all belong in the same activity group? Reply yes or no. Nothing will be saved until you confirm.`,
          },
        ]);
      }
      setChatBusy(false);
      return;
    }

    if (isTransient && isAdditionalQuestionRequest) {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          text: "Save this question first. Then you can add more questions to this activity group.",
        },
      ]);
      setChatBusy(false);
      return;
    }

    if (isAdditionalQuestionRequest && !authoringState.readyForMultiQuestionGeneration) {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          text: "This draft needs an activity group before I can add more questions. Choose or create a group first.",
        },
      ]);
      setChatBusy(false);
      return;
    }

    try {
      let result: { draft: ContentDraft } | null = null;

      if (isAdditionalQuestionRequest) {
        const iterations = requestedAdditionalQuestionCount(text);
        const seedBase = hasActivityBodyContent(lastGenerationContext) ? lastGenerationContext : body;

        let nextSeed = seedBase;
        for (let i = 0; i < iterations; i += 1) {
          const createResult = await apiFetch<{ draft: ContentDraft }>(
            "/api/thinkertools-missions-create/drafts",
            {
              method: "POST",
              body: JSON.stringify({
                contentType: "activity",
                primaryTrainingId: currentDraft.primaryTrainingId,
                activityGroupId: currentDraft.activityGroupId,
                title: currentDraft.title || undefined,
              }),
            },
          );

          const generated = await apiFetch<{ draft: ContentDraft }>(
            `/api/thinkertools-missions-create/drafts/${createResult.draft.id}/generate`,
            {
              method: "POST",
              body: JSON.stringify({
                description: buildAdditionalQuestionDescription(
                  nextSeed,
                  text,
                  currentDraft.trainingTitle,
                  currentDraft.activityGroupTitle,
                ),
              }),
            },
          );

          const generatedBody = toActivityBody(generated.draft.body);
          nextSeed = generatedBody;
          setQuestionDrafts((prev) => upsertQuestionDraft(prev, generated.draft));
        }

        setLastGenerationContext(nextSeed);
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            text: `Done — added ${iterations} new question${iterations > 1 ? "s" : ""}. Use the question selector in the manual form to review and edit them.`,
          },
        ]);
      } else if (!hasDraftContent) {
        // First message — generate from scratch
        if (isTransient) {
          const preview = await apiFetch<{
            body: ActivityBody;
            aiSource: ContentDraft["aiSource"];
            aiModel: string | null;
          }>("/api/thinkertools-missions-create/activity-preview", {
            method: "POST",
            body: JSON.stringify({ action: "generate", description: text }),
          });
          result = {
            draft: {
              ...currentDraft,
              body: preview.body,
              status: "valid",
              origin: "ai",
              validationIssues: [],
              aiSource: preview.aiSource,
              aiModel: preview.aiModel,
            },
          };
        } else {
          result = await apiFetch<{ draft: ContentDraft }>(
            `/api/thinkertools-missions-create/drafts/${draftId}/generate`,
            { method: "POST", body: JSON.stringify({ description: text }) },
          );
        }
        const b2 = toActivityBody(result.draft.body);
        const summary = summariseDraft(b2);
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            text: `Done! I've drafted an activity: ${summary}. Review every field in the manual form, or keep chatting to refine it.`,
          },
        ]);
      } else {
        // Subsequent messages — refine
        if (isTransient) {
          const preview = await apiFetch<{
            body: ActivityBody;
            aiSource: ContentDraft["aiSource"];
            aiModel: string | null;
          }>("/api/thinkertools-missions-create/activity-preview", {
            method: "POST",
            body: JSON.stringify({
              action: "refine",
              currentBody: body,
              instruction: text,
            }),
          });
          result = {
            draft: {
              ...currentDraft,
              body: preview.body,
              status: "valid",
              origin: currentDraft.origin === "manual" ? "co_authored" : currentDraft.origin,
              validationIssues: [],
              aiSource: preview.aiSource,
              aiModel: preview.aiModel,
            },
          };
        } else {
          result = await apiFetch<{ draft: ContentDraft }>(
            `/api/thinkertools-missions-create/drafts/${draftId}/refine`,
            { method: "POST", body: JSON.stringify({ instruction: text }) },
          );
        }
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

      if (result) {
        syncFormFromDraft(result.draft);
      }
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

  function handleChatKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  // ── Form save ────────────────────────────────────────────────────────────
  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    setHasRequestedValidation(true);

    const promptClaims = promptClaimsRaw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const correctLabels = correctAnswerLabels
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const draftBody = {
        round_type: "activity_standard",
        question_text: questionText,
        prompt_claims: promptClaims,
        correct_answer_labels: correctLabels,
        explanation,
        expected_answer_count: expectedAnswerCount,
      };
      const result = isTransient
        ? await apiFetch<{ draft: ContentDraft }>(
            "/api/thinkertools-missions-create/drafts",
            {
              method: "POST",
              body: JSON.stringify({
                contentType: "activity",
                primaryTrainingId: currentDraft.primaryTrainingId,
                activityGroupId: currentDraft.activityGroupId,
                title: title.trim() || undefined,
                body: draftBody,
              }),
            },
          )
        : await apiFetch<{ draft: ContentDraft }>(
            `/api/thinkertools-missions-create/drafts/${draftId}`,
            {
              method: "PATCH",
              body: JSON.stringify({
                title: title.trim() || undefined,
                body: draftBody,
              }),
            },
          );
      syncFormFromDraft(result.draft);
      if (isTransient) onDraftCreated?.(result.draft);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      setSaveError(isApiRequestError(err) ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  // ── Publish ──────────────────────────────────────────────────────────────
  async function handlePublish(goLive = false) {
    setPublishing(true);
    setPublishError(null);
    setPublishMenuOpen(false);
    setHasRequestedValidation(true);
    try {
      const result = await apiFetch<{
        draft: ContentDraft;
        publishedActivity: { id: string; slug: string };
      }>(`/api/thinkertools-missions-create/drafts/${draftId}/publish`, {
        method: "POST",
      });
      setPublishedSlug(result.publishedActivity.slug);
      syncFormFromDraft(result.draft);

      if (goLive) {
        setReleasing(true);
        setReleaseError(null);
        try {
          await apiFetch(
            `/api/thinkertools-missions-create/drafts/${draftId}/release`,
            { method: "POST" },
          );
          setIsLive(true);
        } catch (err) {
          setReleaseError(isApiRequestError(err) ? err.message : "Published, but failed to go live.");
        } finally {
          setReleasing(false);
        }
      }
    } catch (err) {
      setPublishError(isApiRequestError(err) ? err.message : "Publish failed.");
    } finally {
      setPublishing(false);
    }
  }

  async function handleDeleteDraft() {
    if (deleting || isTransient) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      await apiFetch(`/api/thinkertools-missions-create/drafts/${draftId}`, {
        method: "DELETE",
      });
      router.push("/thinkertools-missions-create");
    } catch (error) {
      setDeleteError(isApiRequestError(error) ? error.message : "Failed to delete draft.");
      setDeleting(false);
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

  const hasDraftContent = hasActivityBodyContent(body);
  const visibleValidationIssues = hasDraftContent || hasRequestedValidation
    ? validationIssues
    : [];
  const needsActivityGroup = authoringState.needsActivityGroup;
  const questionIsLive = isLive || currentDraft.publishedActivityStatus === "live";
  const canRemoveActivityGroup = Boolean(
    currentDraft.activityGroupId && !isTransient && !questionIsLive,
  );
  const trainingSubject = currentDraft.trainingTitle?.trim() || currentDraft.title.trim();
  const activeQuestionIndex = Math.max(
    0,
    questionDrafts.findIndex((item) => item.id === currentDraft.id),
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          {trainingSubject ? (
            <BadgeTooltip description={`This question belongs to the ${trainingSubject} training subject.`}>
              <span
                aria-label={`Training subject: ${trainingSubject}`}
                className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700"
                tabIndex={0}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-violet-500" aria-hidden="true" />
                Training: {trainingSubject}
              </span>
            </BadgeTooltip>
          ) : null}
          {currentDraft.activityGroupTitle ? (
            <BadgeTooltip description="This question belongs to this activity group.">
              <span
                aria-label={`${currentDraft.activityGroupTitle}. This question belongs to this activity group.`}
                className="inline-flex items-center gap-1 rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-medium text-cyan-700"
                tabIndex={0}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" aria-hidden="true" />
                {currentDraft.activityGroupTitle}
              </span>
            </BadgeTooltip>
          ) : (
            <BadgeTooltip description="Choose an activity group before publishing or creating more questions.">
              <span
                aria-label="Needs activity group. Choose an activity group before publishing or creating more questions."
                className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800"
                tabIndex={0}
              >
                Needs activity group
              </span>
            </BadgeTooltip>
          )}
          {isTransient ? (
            <BadgeTooltip description="This question has not been saved yet.">
              <span
                aria-label="Not saved. This question has not been saved yet."
                className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800"
                tabIndex={0}
              >
                Not saved
              </span>
            </BadgeTooltip>
          ) : (
            <BadgeTooltip description={STATUS_DESCRIPTIONS[currentDraft.status]}>
              <span
                aria-label={`${STATUS_LABELS[currentDraft.status]}. ${STATUS_DESCRIPTIONS[currentDraft.status]}`}
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[currentDraft.status]}`}
                tabIndex={0}
              >
                {STATUS_LABELS[currentDraft.status]}
              </span>
            </BadgeTooltip>
          )}
          {visibleValidationIssues.length > 0 ? (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-600">
              {visibleValidationIssues.length} issue{visibleValidationIssues.length !== 1 ? "s" : ""}
            </span>
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
          Click &quot;Go Live&quot; to make it visible to players
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

      <div className="grid min-h-[620px] lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* AI CHAT PLANE                                                      */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <section className="flex min-h-[520px] flex-col border-b border-slate-100 lg:border-b-0 lg:border-r">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">AI Chat</h2>
            <p className="mt-0.5 text-xs text-slate-400">Ask for drafts, revisions, or extra questions.</p>
          </div>

          {/* Message list */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className="space-y-2">
                <div
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
              {visibleValidationIssues.length > 0 ? (
                <ul className="mt-2 space-y-0.5">
                  {visibleValidationIssues.map((issue, i) => (
                    <li key={i} className="text-[11px] text-rose-600">
                      {issue.path ? `${issue.path}: ` : ""}{issue.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {pendingQuestionBatch?.confirmed ? (
            <div className="mx-4 mb-3 space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm font-semibold text-amber-950">
                Create {pendingQuestionBatch.questions.length} separate questions
              </p>
              <p className="text-xs text-amber-800">
                {currentDraft.activityGroupTitle
                  ? `Confirmed activity group: ${currentDraft.activityGroupTitle}`
                  : "Assign or create an activity group in the manual form before creating this batch."}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void createPastedQuestionBatch()}
                  disabled={chatBusy || !currentDraft.activityGroupId}
                  className="rounded-md bg-amber-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-40"
                >
                  {chatBusy ? "Creating…" : "Create batch"}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingQuestionBatch(null)}
                  disabled={chatBusy}
                  className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-40"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {/* Chat input */}
          <form
            onSubmit={handleChatSubmit}
            className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3"
          >
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleChatKeyDown}
              disabled={chatBusy || pendingQuestionBatch?.confirmed}
              rows={2}
              placeholder={
                pendingQuestionBatch?.confirmed
                  ? "Confirm the activity group above to continue…"
                  : pendingQuestionBatch
                    ? "Reply yes or no…"
                : hasDraftContent
                  ? "Refine this question, or ask for more questions…"
                  : "Describe what you want learners to practice…"
              }
              className="min-h-11 flex-1 resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={chatBusy || pendingQuestionBatch?.confirmed || !chatInput.trim()}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
            >
              {chatBusy ? "…" : "Send"}
            </button>
            <p className="basis-full text-[11px] text-slate-400">
              Enter to send · Shift+Enter for a new line
            </p>
          </form>
          {chatError ? (
            <p className="px-4 pb-3 text-xs text-rose-600">{chatError}</p>
          ) : null}
        </section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* FORM PLANE                                                         */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <form onSubmit={handleSave} className="space-y-4 px-5 py-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Manual Form</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Edit fields directly. Saving keeps your changes in this private draft.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="mb-2 text-xs font-medium text-slate-500">Question</p>
            <div className="flex flex-wrap gap-2">
              {questionDrafts.map((questionDraft, index) => (
                <button
                  key={questionDraft.id}
                  type="button"
                  onClick={() => selectQuestionDraft(questionDraft)}
                  disabled={saving || questionDraft.id === currentDraft.id}
                  aria-current={questionDraft.id === currentDraft.id ? "true" : undefined}
                  className={`flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-semibold transition-colors ${
                    questionDraft.id === currentDraft.id
                      ? "border-slate-900 bg-white text-slate-900 shadow-sm"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-800"
                  } disabled:cursor-default disabled:opacity-100`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Editing question {activeQuestionIndex + 1} of {questionDrafts.length}.
            </p>
          </div>
          <p className="text-xs text-slate-400">
            Fields stay in sync with the AI chat. Save does not publish or make this question visible to players.
          </p>

          {/* Validation issues */}
          {visibleValidationIssues.length > 0 ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="mb-1.5 text-xs font-semibold text-rose-700">Validation issues</p>
              <ul className="space-y-1">
                {visibleValidationIssues.map((issue, i) => (
                  <li key={i} className="text-xs text-rose-700">
                    {issue.path ? <span className="font-medium">{issue.path}: </span> : null}
                    {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <label className="flex flex-col gap-1 text-xs text-slate-600">
            <span className="font-medium">Training Subject</span>
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

          <div className="flex flex-col gap-1 text-xs text-slate-600">
            <span className="font-medium">Activity Group</span>
            {needsActivityGroup ? (
              <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/70 p-3">
                <p className="text-xs text-amber-900">
                  Choose where this question belongs, or intentionally create a new group.
                </p>
                <div className="flex min-w-0 gap-2">
                  <label className="sr-only" htmlFor="existing-activity-group">Existing activity group</label>
                  <select
                    id="existing-activity-group"
                    value={selectedActivityGroupId}
                    onChange={(e) => {
                      setSelectedActivityGroupId(e.target.value);
                      setActivityGroupAssignmentError(null);
                    }}
                    disabled={assigningActivityGroup || loadingActivityGroups || activityGroups.length === 0}
                    className="min-w-0 flex-1 rounded-md border border-amber-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-amber-400 focus:outline-none disabled:opacity-60"
                  >
                    <option value="">
                      {loadingActivityGroups
                        ? "Loading groups…"
                        : activityGroups.length === 0
                          ? "No existing groups"
                          : "Choose an existing group…"}
                    </option>
                    {activityGroups.map((group) => (
                      <option key={group.id} value={group.id}>{group.title}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleExistingActivityGroupAssignment}
                    disabled={assigningActivityGroup || !selectedActivityGroupId}
                    className="shrink-0 rounded-md bg-amber-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-40"
                  >
                    Assign
                  </button>
                </div>

                <div className="flex min-w-0 gap-2">
                  <label className="sr-only" htmlFor="new-activity-group-title">New activity group name</label>
                  <input
                    id="new-activity-group-title"
                    type="text"
                    value={newActivityGroupTitle}
                    onChange={(e) => {
                      setNewActivityGroupTitle(e.target.value);
                      setActivityGroupAssignmentError(null);
                    }}
                    disabled={assigningActivityGroup}
                    maxLength={200}
                    placeholder="Or name a new group…"
                    className="min-w-0 flex-1 rounded-md border border-amber-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={handleCreateAndAssignActivityGroup}
                    disabled={assigningActivityGroup || !newActivityGroupTitle.trim()}
                    className="shrink-0 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-40"
                  >
                    {assigningActivityGroup ? "Working…" : "Create & assign"}
                  </button>
                </div>
                {activityGroupsError ? (
                  <p className="text-xs text-rose-700">{activityGroupsError}</p>
                ) : null}
                {activityGroupAssignmentError ? (
                  <p className="text-xs text-rose-700">{activityGroupAssignmentError}</p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5">
                  <span className="min-w-0 truncate text-sm text-slate-900">
                    {currentDraft.activityGroupTitle}
                  </span>
                  {canRemoveActivityGroup ? (
                    <button
                      type="button"
                      onClick={() => void handleRemoveActivityGroup()}
                      disabled={assigningActivityGroup}
                      className="shrink-0 text-xs font-medium text-rose-700 hover:text-rose-900 disabled:cursor-wait disabled:opacity-50"
                    >
                      {assigningActivityGroup ? "Removing…" : "Remove from group"}
                    </button>
                  ) : null}
                </div>
                {questionIsLive ? (
                  <p className="text-xs text-slate-500">
                    Live questions cannot be removed from their activity group.
                  </p>
                ) : null}
                {activityGroupAssignmentError ? (
                  <p className="text-xs text-rose-700">{activityGroupAssignmentError}</p>
                ) : null}
              </div>
            )}
          </div>

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
              Correct answers <span className="font-normal text-slate-400">(comma-separated, e.g. A, C)</span>
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

          <div className="border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
              >
                {saving ? "Saving draft…" : "Save draft"}
              </button>
              {!isTransient ? (
                <a
                  href={`/thinkertools-missions-create/drafts/${draftId}/play`}
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Preview draft
                </a>
              ) : null}
              <div className="relative inline-flex">
                <button
                  type="button"
                  onClick={() => void handlePublish()}
                  disabled={publishing || isTransient || !authoringState.readyToPublish}
                  title={
                    isTransient
                      ? "Save this draft before publishing."
                      : needsActivityGroup
                      ? "Assign this draft to an activity group before publishing."
                      : "Create a pending activity from this draft. Players cannot see it until you go live."
                  }
                  className="rounded-l-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-40"
                >
                  {publishing ? "Publishing…" : "Publish as pending"}
                </button>
                <button
                  type="button"
                  aria-label="More publishing options"
                  aria-haspopup="menu"
                  aria-expanded={publishMenuOpen}
                  onClick={() => setPublishMenuOpen((open) => !open)}
                  disabled={publishing || isTransient || !authoringState.readyToPublish}
                  className="rounded-r-md border-l border-emerald-600 bg-emerald-700 px-2 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-40"
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3 w-3 fill-current">
                    <path d="M4.2 6.1 8 9.9l3.8-3.8.9.9L8 11.7 3.3 7l.9-.9Z" />
                  </svg>
                </button>
                {publishMenuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-10 mt-1 w-52 rounded-md border border-slate-200 bg-white p-1 shadow-lg"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void handlePublish(true)}
                      className="w-full rounded px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                    >
                      <span className="block font-medium text-slate-900">Publish &amp; go live</span>
                      <span className="block pt-0.5 text-slate-500">Make this activity visible to players now.</span>
                    </button>
                  </div>
                ) : null}
              </div>
              {currentDraft.status === "published" && publishedSlug && !isLive ? (
                <button
                  type="button"
                  onClick={handleRelease}
                  disabled={releasing || needsActivityGroup}
                  title={needsActivityGroup ? "Assign an activity group before going live." : undefined}
                  className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600 disabled:opacity-40"
                >
                  {releasing ? "Going Live…" : "Go Live"}
                </button>
              ) : null}
              {saveSuccess ? <span className="text-xs text-emerald-600">Draft saved — not published.</span> : null}
              {saveError ? <span className="text-xs text-rose-700">{saveError}</span> : null}
              {deleteError ? <span className="text-xs text-rose-700">{deleteError}</span> : null}
              {!isTransient && (currentDraft.status === "draft" || currentDraft.status === "valid") ? (
                <button
                  type="button"
                  onClick={() => void handleDeleteDraft()}
                  disabled={deleting}
                  aria-label="Delete draft"
                  title="Delete draft"
                  className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-rose-600 text-white hover:bg-rose-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {deleting ? (
                    <span className="text-xs" aria-hidden="true">…</span>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                      <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5A.75.75 0 0 1 9.95 6Z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ) : null}
            </div>
            <p className="mt-3 text-xs text-slate-600">
              <span className="font-medium text-slate-800">How this works:</span>{" "}
              Save keeps your edits in this private draft. Publish as pending creates an activity for review, or use the menu to publish and make it live now.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
