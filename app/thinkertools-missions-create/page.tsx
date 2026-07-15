"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";

import { apiFetch, isApiRequestError } from "@/components/quipx/client";
import { DraftList } from "@/components/thinkertools-missions-create/draft-list";
import { SubjectWorkspace } from "@/components/thinkertools-missions-create/subject-workspace";
import type {
  AuthoringActivityGroup,
  UncategorizedActivityContent,
} from "@/components/thinkertools-missions-create/activity-group-browser";
import { ActivityGroupsJumpLink } from "@/components/thinkertools-missions-create/activity-groups-jump-link";
import type { ContentDraft, DraftContentType } from "@/lib/authoring/draft-types";
import { extractPastedQuestionBatch } from "@/lib/authoring/question-batch";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

// ─── Types ────────────────────────────────────────────────────────────────────

// Guided flow:
//   subject → format → describe → generate → editor
type FlowStep = "subject" | "format" | "describe";

type Training = { 
  id: string; 
  slug: string; 
  title: string; 
  description: string; 
  publication_status: 'pending' | 'live' | 'archived';
  isEmpty?: boolean;
  isDraftOnly?: boolean;
  hasReleasableContent?: boolean;
};
type ActivityGroup = {
  id: string;
  slug: string;
  title: string;
  description: string;
  training_id: string;
  questionCount?: number;
  questions?: Array<{
    id: string;
    title: string;
    questionText: string;
    difficultyLabel: string;
    publicationStatus: "pending" | "live";
  }>;
  draftStatusCounts?: Partial<Record<ContentDraft["status"], number>>;
  drafts?: Array<{
    id: string;
    title: string;
    questionText: string;
    status: ContentDraft["status"];
  }>;
};

type ListTrainingsResponse = { trainings: Training[] };
type CreateTrainingResponse = { training: Training };
type ListGroupsResponse = {
  groups: ActivityGroup[];
  uncategorized: UncategorizedActivityContent;
};
type CreateGroupResponse = { group: ActivityGroup };
type ListDraftsResponse = { drafts: ContentDraft[] };
type CreateDraftResponse = { draft: ContentDraft };
type SubjectShiftResponse = {
  shouldSwitch: boolean;
  subjectId?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  formatChoice?: true;
  directionOptions?: BroadIntentOption[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

let msgCounter = 0;
function nextId() { msgCounter += 1; return `m-${msgCounter}`; }
const FORMAT_OPTIONS: DraftContentType[] = ["activity", "mission"];
const INTENT_STOP_WORDS = new Set([
  "a", "an", "am", "and", "are", "as", "at", "be", "by", "do", "for", "go", "he", "hi", "i",
  "if", "in", "is", "it", "me", "my", "no", "of", "ok", "on", "or", "so", "to", "up", "us",
  "we", "the", "with", "that", "this", "from", "into", "about", "what", "when", "where",
  "which", "their", "there", "have", "will", "your", "them", "they", "would", "could", "should",
  "learners", "students", "practice", "questions", "question",
]);

function tokenizeIntent(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 0 && !INTENT_STOP_WORDS.has(word));
}

function isIdeationPrompt(intent: string): boolean {
  const normalized = intent.toLowerCase().trim();
  if (!normalized) return false;
  const markers = [
    "not sure", "dont know", "don't know", "no idea", "need ideas", "need help", "stuck", "help me start", "suggest ideas",
  ];
  if (markers.some((marker) => normalized.includes(marker))) return true;
  return normalized === "ideas" || normalized === "suggest ideas";
}

function requestsMultipleQuestions(input: string): boolean {
  const normalized = input.toLowerCase().trim();
  if (!normalized.includes("question")) return false;

  const numericCount = normalized.match(/\b(\d+)\s+(?:new\s+|additional\s+)?questions?\b/);
  if (numericCount && Number.parseInt(numericCount[1], 10) > 1) return true;

  if (
    /\b(?:two|three|four|five|six|seven|eight|nine|ten)\s+(?:new\s+|additional\s+)?questions?\b/.test(
      normalized,
    )
  ) {
    return true;
  }

  if (/\b(?:multiple|several|some|a few|a couple of)\s+(?:new\s+|additional\s+)?questions\b/.test(normalized)) {
    return true;
  }

  return /\b(?:generate|create|write|draft|make|add|give me)\b[^.!?]{0,80}\bquestions\b/.test(
    normalized,
  );
}

type BroadIntentOption = {
  id: string;
  label: string;
  prompt: string;
};
type IdeaDirectionsResponse = { options: BroadIntentOption[] };
type IdeaReplyInterpretation = {
  intent: "revise_directions" | "draft_focus";
  refinement?: string;
  focus?: string;
};

type ActivityPhase =
  | { kind: "idle" }
  | { kind: "await_readiness"; topic: string }
  | { kind: "await_focus"; topic: string }
  | { kind: "ideation"; topic: string; options: BroadIntentOption[] };

type PendingQuestionBatch = {
  questions: string[];
  stage: "confirm" | "choose_group";
};

function isBroadIntent(intent: string): boolean {
  const normalized = intent.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.includes("?")) return false;
  const tokens = tokenizeIntent(normalized);
  if (tokens.length === 0 || tokens.length > 4) return false;

  // If the user already gave explicit instruction verbs, treat it as specific.
  const specificMarkers = ["explain", "compare", "evaluate", "analyze", "design", "create", "why", "how"];
  return !specificMarkers.some((marker) => normalized.includes(marker));
}

function buildBroadIntentOptions(topic: string): BroadIntentOption[] {
  return [
    {
      id: "1",
      label: "Core concepts",
      prompt: `${topic} focused on core terms, examples, and relationships learners should recognize.`,
    },
    {
      id: "2",
      label: "Common misconceptions",
      prompt: `${topic} focused on identifying and correcting common misconceptions.`,
    },
    {
      id: "3",
      label: "Compare and classify",
      prompt: `${topic} focused on comparing examples and classifying important differences.`,
    },
    {
      id: "4",
      label: "Real-world applications",
      prompt: `${topic} focused on short real-world scenarios that require applied reasoning.`,
    },
    {
      id: "5",
      label: "Evidence and reasoning",
      prompt: `${topic} focused on evaluating evidence and choosing the best-supported claim.`,
    },
  ];
}

function buildBroadIntentMessage(topic: string, options: BroadIntentOption[]): string {
  const firstId = options[0]?.id ?? "1";
  const lastId = options[options.length - 1]?.id ?? String(options.length);
  return `Choose a starting direction for "${topic}", ask for different directions, or type your own focus. Reply with ${firstId}-${lastId}.`;
}

function normalizeDirectionOptions(options: BroadIntentOption[]): BroadIntentOption[] {
  return options.map((option, index) => ({
    ...option,
    id: String(index + 1),
  }));
}

function resolveBroadIntentChoice(input: string, options: BroadIntentOption[]): BroadIntentOption | null {
  const normalized = input.trim().toLowerCase();
  const byNumber = options.find((option) =>
    normalized === option.id || normalized === `option ${option.id}` || normalized === `#${option.id}`,
  );
  if (byNumber) return byNumber;

  const byLabel = options.find((option) => normalized.includes(option.label.toLowerCase()));
  return byLabel ?? null;
}

function buildBroadTopicDecisionMessage(topic: string): string {
  return `Got it — "${topic}". Do you already have questions or ideas in mind, or do you need ideas?`;
}

function needsIdeasResponse(input: string): boolean {
  const normalized = input.toLowerCase().trim();
  const quickNoResponses = new Set(["no", "nope", "nah", "not really"]);
  if (quickNoResponses.has(normalized)) return true;

  const markers = [
    "no ideas",
    "need ideas",
    "need help",
    "not sure",
    "no idea",
    "stuck",
    "help me",
    "suggest",
    "dont have ideas",
    "don't have ideas",
    "do not have ideas",
    "dont have any ideas",
    "don't have any ideas",
    "no ideas in mind",
  ];
  return markers.some((marker) => normalized.includes(marker));
}

function hasIdeasResponse(input: string): boolean {
  const normalized = input.toLowerCase().trim();
  if (
    normalized.includes("dont have ideas")
    || normalized.includes("don't have ideas")
    || normalized.includes("do not have ideas")
    || normalized.includes("dont have any ideas")
    || normalized.includes("don't have any ideas")
    || normalized.includes("no ideas in mind")
  ) {
    return false;
  }

  const markers = ["have ideas", "i do", "yes", "already have", "my own", "i have questions"];
  return markers.some((marker) => normalized.includes(marker));
}

function isAffirmative(input: string): boolean {
  const normalized = input.toLowerCase().trim();
  const values = ["yes", "y", "switch", "switch it", "use that", "go ahead", "ok", "okay"];
  return values.some((value) => normalized === value || normalized.includes(value));
}

function isNegative(input: string): boolean {
  const normalized = input.toLowerCase().trim();
  const values = ["no", "n", "stay", "keep", "dont switch", "don't switch", "keep this"];
  return values.some((value) => normalized === value || normalized.includes(value));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MissionsCreatePage() {
  const router = useRouter();

  // ── Auth ─────────────────────────────────────────────────────────────────
  const [authError, setAuthError] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // ── Training data ────────────────────────────────────────────────────────
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loadingTrainings, setLoadingTrainings] = useState(true);
  const [newTrainingTitle, setNewTrainingTitle] = useState("");
  const [creatingTraining, setCreatingTraining] = useState(false);
  const [trainingError, setTrainingError] = useState<string | null>(null);

  // Trainings for drafts: empty, draft-only, or pending
  const draftTrainings = trainings.filter(t =>
    t.isEmpty || t.isDraftOnly || t.publication_status === 'pending'
  );

  // Trainings for picker: only live trainings that have content
  const pickerTrainings = trainings.filter(t => 
    t.publication_status === 'live' && !t.isEmpty
  );

  const manualTrainings = trainings.filter(
    (training) => training.publication_status !== "archived",
  );

  // ── Activity group data ──────────────────────────────────────────────────
  const [groups, setGroups] = useState<ActivityGroup[]>([]);
  const [uncategorized, setUncategorized] = useState<UncategorizedActivityContent>({
    questions: [],
    drafts: [],
  });
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);

  // ── Guided flow state ────────────────────────────────────────────────────
  const [step, setStep] = useState<FlowStep>("subject");
  const [selectedTraining, setSelectedTraining] = useState<Training | null>(null);
  const [selectedContentType, setSelectedContentType] = useState<DraftContentType | null>(null);
  const [activeFormatOption, setActiveFormatOption] = useState<DraftContentType>("activity");

  // ── Draft list ───────────────────────────────────────────────────────────
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ── Manual form state ────────────────────────────────────────────────────
  const [manualTrainingId, setManualTrainingId] = useState("");
  const [formContentType, setFormContentType] = useState<DraftContentType>("activity");
  const [formTitle, setFormTitle] = useState("");
  const [formCreating, setFormCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ── Chat messages ────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [activityPhase, setActivityPhase] = useState<ActivityPhase>({ kind: "idle" });
  const [pendingTrainingSwitch, setPendingTrainingSwitch] = useState<{
    toTrainingId: string;
    toTrainingTitle: string;
    queuedIntent: string;
  } | null>(null);
  const [pendingQuestionBatch, setPendingQuestionBatch] = useState<PendingQuestionBatch | null>(null);
  const [batchActivityGroupId, setBatchActivityGroupId] = useState("");
  const [newBatchActivityGroupTitle, setNewBatchActivityGroupTitle] = useState("");
  const [batchError, setBatchError] = useState<string | null>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const trainingFormRef = useRef<HTMLFormElement>(null);
  const chatFormRef = useRef<HTMLFormElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const manualFormRef = useRef<HTMLFormElement>(null);
  const activityFormatButtonRef = useRef<HTMLButtonElement>(null);
  const missionFormatButtonRef = useRef<HTMLButtonElement>(null);

  async function loadGroupsForTraining(trainingId: string): Promise<ActivityGroup[]> {
    setLoadingGroups(true);
    setGroupsError(null);
    try {
      const result = await apiFetch<ListGroupsResponse>(
        `/api/thinkertools-missions-create/activity-groups?trainingId=${trainingId}`,
      );
      setGroups(result.groups);
      setUncategorized(result.uncategorized);
      return result.groups;
    } catch {
      setGroups([]);
      setUncategorized({ questions: [], drafts: [] });
      setGroupsError("Failed to load activity groups.");
      return [];
    } finally {
      setLoadingGroups(false);
    }
  }

  function detectSubjectShift(
    intent: string,
    currentTraining: Training,
    allTrainings: Training[],
  ): Training | null {
    const intentTokens = tokenizeIntent(intent);
    if (intentTokens.length === 0) return null;

    const scoreTraining = (training: Training) => {
      const trainingTokens = new Set(
        tokenizeIntent(`${training.title} ${training.slug} ${training.description || ""}`),
      );
      return intentTokens.reduce((count, token) => count + (trainingTokens.has(token) ? 1 : 0), 0);
    };

    const currentScore = scoreTraining(currentTraining);
    let bestCandidate: Training | null = null;
    let bestScore = 0;
    for (const training of allTrainings) {
      if (training.id === currentTraining.id) continue;
      const score = scoreTraining(training);
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = training;
      }
    }

    if (!bestCandidate) return null;
    if (bestScore < 1) return null;
    if (bestScore <= currentScore) return null;
    return bestCandidate;
  }

  async function detectSemanticSubjectShift(
    intent: string,
    currentTraining: Training,
    allTrainings: Training[],
  ): Promise<Training | null> {
    const candidates = allTrainings.filter((training) => training.id !== currentTraining.id);
    if (candidates.length === 0) return null;

    try {
      const result = await apiFetch<SubjectShiftResponse>(
        "/api/thinkertools-missions-create/subject-shift",
        {
          method: "POST",
          body: JSON.stringify({
            currentSubject: {
              id: currentTraining.id,
              title: currentTraining.title,
              description: currentTraining.description || "",
            },
            reply: intent,
            candidates: candidates.map((training) => ({
              id: training.id,
              title: training.title,
              description: training.description || "",
            })),
          }),
        },
      );

      if (!result.shouldSwitch || !result.subjectId) return null;
      return candidates.find((training) => training.id === result.subjectId) ?? null;
    } catch {
      return null;
    }
  }

  async function findSubjectShift(
    intent: string,
    currentTraining: Training,
    allTrainings: Training[],
  ): Promise<Training | null> {
    return detectSubjectShift(intent, currentTraining, allTrainings)
      ?? await detectSemanticSubjectShift(intent, currentTraining, allTrainings);
  }

  async function loadIdeaDirections(
    topic: string,
    training: Training,
    refinement?: string,
  ): Promise<BroadIntentOption[]> {
    try {
      const result = await apiFetch<IdeaDirectionsResponse>(
        "/api/thinkertools-missions-create/idea-directions",
        {
          method: "POST",
          body: JSON.stringify({
            subject: topic,
            context: [
              training.title,
              training.description,
              refinement ? `Revise the starting directions based on this educator request: ${refinement}` : "",
            ].filter(Boolean).join("\n"),
            count: 5,
          }),
        },
      );

      if (result.options.length > 0) {
        return normalizeDirectionOptions(result.options);
      }
    } catch {
      // Fall through to generic local options if AI or the network is unavailable.
    }

    return normalizeDirectionOptions(buildBroadIntentOptions(topic));
  }

  async function interpretIdeaReply(
    topic: string,
    reply: string,
    options: BroadIntentOption[],
  ): Promise<IdeaReplyInterpretation> {
    try {
      return await apiFetch<IdeaReplyInterpretation>(
        "/api/thinkertools-missions-create/idea-reply",
        {
          method: "POST",
          body: JSON.stringify({
            subject: topic,
            reply,
            options,
          }),
        },
      );
    } catch {
      return {
        intent: "revise_directions",
        refinement: reply,
      };
    }
  }

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!data.session) {
        setAuthError(true); setAuthChecked(true);
        setLoadingTrainings(false); setLoadingDrafts(false);
        return;
      }
      setAuthChecked(true);
      const [trainingsResult, draftsResult] = await Promise.allSettled([
        apiFetch<ListTrainingsResponse>("/api/thinkertools-missions-create/trainings"),
        apiFetch<ListDraftsResponse>("/api/thinkertools-missions-create/drafts"),
      ]);
      if (!mounted) return;
      if (trainingsResult.status === "fulfilled") setTrainings(trainingsResult.value.trainings);
      setLoadingTrainings(false);
      if (draftsResult.status === "fulfilled") setDrafts(draftsResult.value.drafts);
      else setFetchError(isApiRequestError(draftsResult.reason) ? draftsResult.reason.message : "Failed to load drafts.");
      setLoadingDrafts(false);
    };
    void init();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const messagesEl = chatMessagesRef.current;
    if (!messagesEl) return;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!selectedTraining || step !== "format") return;
    const animationFrame = window.requestAnimationFrame(() => {
      activityFormatButtonRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [selectedTraining, step]);

  useEffect(() => {
    if (!selectedTraining || step !== "describe" || chatBusy) return;
    const animationFrame = window.requestAnimationFrame(() => {
      chatInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [selectedTraining, step, chatBusy, activityPhase.kind, pendingTrainingSwitch]);

  // ── Step 1: select training ───────────────────────────────────────────────
  function selectTraining(training: Training) {
    setSelectedTraining(training);
    setManualTrainingId(training.id);
    setSelectedContentType(null);
    setActivityPhase({ kind: "idle" });
    setPendingTrainingSwitch(null);
    setPendingQuestionBatch(null);
    setBatchActivityGroupId("");
    setNewBatchActivityGroupTitle("");
    setBatchError(null);
    setActiveFormatOption("activity");
    void loadGroupsForTraining(training.id);
    setStep("format");
    setMessages([
      { id: nextId(), role: "user", text: training.title },
      { id: nextId(), role: "assistant", text: `Got it — ${training.title}. What kind of content do you want to make?`, formatChoice: true },
    ]);
  }

  function resumeTraining(training: Training) {
    selectTraining(training);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleCreateTraining(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const title = newTrainingTitle.trim();
    if (!title) return;
    setCreatingTraining(true); setTrainingError(null);
    try {
      const result = await apiFetch<CreateTrainingResponse>("/api/thinkertools-missions-create/trainings", { method: "POST", body: JSON.stringify({ title }) });
      setTrainings((prev) => [...prev, result.training]);
      setNewTrainingTitle("");
      selectTraining(result.training);
    } catch (err) {
      setTrainingError(isApiRequestError(err) ? err.message : "Failed to create training.");
    } finally { setCreatingTraining(false); }
  }

  // ── Step 2: choose format ─────────────────────────────────────────────────
  async function selectFormat(contentType: DraftContentType) {
    setActiveFormatOption(contentType);
    setSelectedContentType(contentType);
    setActivityPhase({ kind: "idle" });
    setPendingTrainingSwitch(null);
    setPendingQuestionBatch(null);
    setBatchActivityGroupId("");
    setNewBatchActivityGroupTitle("");
    setBatchError(null);
    const label = contentType === "activity" ? "Quick practice questions" : "Story-based mission";
    setMessages((prev) => [...prev, { id: nextId(), role: "user", text: label }]);

    if (contentType === "mission") {
      // Missions skip the group step
      setStep("describe");
      setMessages((prev) => [...prev, {
        id: nextId(), role: "assistant",
        text: "Describe the scenario or situation for the mission — the setting, the conflict, and what you want learners to figure out.",
      }]);
      return;
    }

    // Activities use the selected training subject as their category.
    await loadGroupsForTraining(selectedTraining!.id);
    setStep("describe");

    setMessages((prev) => [...prev, {
      id: nextId(), role: "assistant",
      text: "What should this practice cover? You can paste an example question, name a broad topic, or say you're not sure and I’ll suggest starting directions.",
    }]);
  }

  async function createConfirmedQuestionBatch(activityGroupId: string) {
    if (!pendingQuestionBatch || !selectedTraining || chatBusy) return;

    setChatBusy(true);
    setBatchError(null);
    try {
      const createdDrafts: ContentDraft[] = [];
      for (const question of pendingQuestionBatch.questions) {
        const created = await apiFetch<CreateDraftResponse>(
          "/api/thinkertools-missions-create/drafts",
          {
            method: "POST",
            body: JSON.stringify({
              contentType: "activity",
              primaryTrainingId: selectedTraining.id,
              activityGroupId,
              title: selectedTraining.title,
            }),
          },
        );
        const generated = await apiFetch<CreateDraftResponse>(
          `/api/thinkertools-missions-create/drafts/${created.draft.id}/generate`,
          {
            method: "POST",
            body: JSON.stringify({
              description: `Build one activity from this teacher-provided question while preserving its intent: ${question}`,
            }),
          },
        );
        createdDrafts.push(generated.draft);
      }

      setDrafts((prev) => [...createdDrafts, ...prev]);
      setPendingQuestionBatch(null);
      setBatchActivityGroupId("");
      setNewBatchActivityGroupTitle("");
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          text: `Created ${createdDrafts.length} separate questions in the confirmed activity group.`,
        },
      ]);
      const firstDraft = createdDrafts[0];
      if (firstDraft) {
        router.push(`/thinkertools-missions-create/drafts/${firstDraft.id}`);
      }
    } catch (error) {
      setBatchError(
        isApiRequestError(error) ? error.message : "Failed to create the question batch.",
      );
    } finally {
      setChatBusy(false);
    }
  }

  async function handleCreateBatchActivityGroup() {
    const title = newBatchActivityGroupTitle.trim();
    if (!selectedTraining || !title || chatBusy) return;

    setChatBusy(true);
    setBatchError(null);
    try {
      const result = await apiFetch<CreateGroupResponse>(
        "/api/thinkertools-missions-create/activity-groups",
        {
          method: "POST",
          body: JSON.stringify({ trainingId: selectedTraining.id, title }),
        },
      );
      setGroups((prev) =>
        prev.some((group) => group.id === result.group.id)
          ? prev
          : [...prev, result.group],
      );
      setChatBusy(false);
      await createConfirmedQuestionBatch(result.group.id);
    } catch (error) {
      setBatchError(
        isApiRequestError(error) ? error.message : "Failed to create the activity group.",
      );
      setChatBusy(false);
    }
  }

  // ── Step 4: describe + generate ──────────────────────────────────────────
  async function handleChatSubmit(e: FormEvent) {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || chatBusy || !selectedTraining || !selectedContentType) return;

    setChatInput(""); setChatError(null);
    setMessages((prev) => [...prev, { id: nextId(), role: "user", text }]);
    setChatBusy(true);

    try {
      let generationDescription = text;
      let activeTraining = selectedTraining;
      let shouldCheckShift = selectedContentType === "activity" && activityPhase.kind === "idle";

      if (pendingQuestionBatch?.stage === "confirm") {
        if (isAffirmative(text)) {
          setPendingQuestionBatch({
            ...pendingQuestionBatch,
            stage: "choose_group",
          });
          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              role: "assistant",
              text: "Choose one existing activity group below, or intentionally name and create a new group for the whole batch.",
            },
          ]);
        } else if (isNegative(text)) {
          setPendingQuestionBatch(null);
          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              role: "assistant",
              text: "Nothing was saved. Split the questions into intentional sets, then add each set to its chosen activity group. You can start with one question at a time here.",
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              role: "assistant",
              text: "Please reply yes if every pasted question belongs in one activity group, or no if they should be separated.",
            },
          ]);
        }
        setChatBusy(false);
        return;
      }

      if (pendingTrainingSwitch) {
        if (isAffirmative(text)) {
          const targetTraining = trainings.find((training) => training.id === pendingTrainingSwitch.toTrainingId) ?? null;
          if (targetTraining) {
            activeTraining = targetTraining;
            setSelectedTraining(targetTraining);
            setActivityPhase({ kind: "idle" });
            await loadGroupsForTraining(targetTraining.id);
            setMessages((prev) => [
              ...prev,
              {
                id: nextId(),
                role: "assistant",
                text: `Switched to "${targetTraining.title}". Continuing with your topic.`,
              },
            ]);
          }
          generationDescription = pendingTrainingSwitch.queuedIntent;
          setPendingTrainingSwitch(null);
          shouldCheckShift = false;
        } else if (isNegative(text)) {
          generationDescription = pendingTrainingSwitch.queuedIntent;
          setPendingTrainingSwitch(null);
          setMessages((prev) => [
            ...prev,
            { id: nextId(), role: "assistant", text: `Got it — staying in "${selectedTraining.title}". Continuing with your topic.` },
          ]);
          shouldCheckShift = false;
        } else {
          setMessages((prev) => [
            ...prev,
            { id: nextId(), role: "assistant", text: `Please reply with yes/no. Switch from "${selectedTraining.title}" to "${pendingTrainingSwitch.toTrainingTitle}"?` },
          ]);
          setChatBusy(false);
          return;
        }
      }

      const activityText = generationDescription;

      if (selectedContentType === "activity") {
        if (activityPhase.kind === "await_readiness") {
          if (needsIdeasResponse(activityText)) {
            const options = await loadIdeaDirections(activityPhase.topic, activeTraining);
            setActivityPhase({ kind: "ideation", topic: activityPhase.topic, options });
            setMessages((prev) => [
              ...prev,
              {
                id: nextId(),
                role: "assistant",
                text: buildBroadIntentMessage(activityPhase.topic, options),
                directionOptions: options,
              },
            ]);
            setChatBusy(false);
            return;
          }

          if (hasIdeasResponse(activityText)) {
            setActivityPhase({ kind: "await_focus", topic: activityPhase.topic });
            setMessages((prev) => [
              ...prev,
              { id: nextId(), role: "assistant", text: `Got it. Share one example question or focus area for "${activityPhase.topic}" and I’ll draft from that.` },
            ]);
            setChatBusy(false);
            return;
          }

          generationDescription = activityText.includes("?")
            ? activityText
            : `${activityPhase.topic} focused on ${activityText}.`;
          setActivityPhase({ kind: "idle" });
          shouldCheckShift = false;
        } else if (activityPhase.kind === "await_focus") {
          if (activityText.length < 3) {
            setMessages((prev) => [
              ...prev,
              { id: nextId(), role: "assistant", text: `Please share one example question or a short focus area for "${activityPhase.topic}".` },
            ]);
            setChatBusy(false);
            return;
          }
          generationDescription = activityText.includes("?")
            ? activityText
            : `${activityPhase.topic} focused on ${activityText}.`;
          setActivityPhase({ kind: "idle" });
          shouldCheckShift = false;
        } else if (activityPhase.kind === "ideation") {
          const selectedOption = resolveBroadIntentChoice(activityText, activityPhase.options);
          if (selectedOption) {
            generationDescription = selectedOption.prompt;
            setActivityPhase({ kind: "idle" });
            setMessages((prev) => [
              ...prev,
              { id: nextId(), role: "assistant", text: `Great — drafting from "${selectedOption.label.toLowerCase()}".` },
            ]);
          } else if (activityText.length >= 3) {
            const interpretation = await interpretIdeaReply(activityPhase.topic, activityText, activityPhase.options);

            if (interpretation.intent === "revise_directions") {
              const options = await loadIdeaDirections(
                activityPhase.topic,
                activeTraining,
                interpretation.refinement || activityText,
              );
              setActivityPhase({ kind: "ideation", topic: activityPhase.topic, options });
              setMessages((prev) => [
                ...prev,
                {
                  id: nextId(),
                  role: "assistant",
                  text: buildBroadIntentMessage(activityPhase.topic, options),
                  directionOptions: options,
                },
              ]);
              setChatBusy(false);
              return;
            }

            const focus = interpretation.focus || activityText;
            generationDescription = focus.includes("?")
              ? focus
              : `${activityPhase.topic} focused on ${focus}.`;
            setActivityPhase({ kind: "idle" });
          } else {
            setMessages((prev) => [
              ...prev,
              {
                id: nextId(),
                role: "assistant",
                text: buildBroadIntentMessage(activityPhase.topic, activityPhase.options),
                directionOptions: activityPhase.options,
              },
            ]);
            setChatBusy(false);
            return;
          }
          shouldCheckShift = false;
        } else {
          if (shouldCheckShift && activeTraining) {
            const shiftedTraining = await findSubjectShift(activityText, activeTraining, trainings);
            if (shiftedTraining) {
              setPendingTrainingSwitch({
                toTrainingId: shiftedTraining.id,
                toTrainingTitle: shiftedTraining.title,
                queuedIntent: activityText,
              });
              setMessages((prev) => [
                ...prev,
                {
                  id: nextId(),
                  role: "assistant",
                  text: `This sounds like "${shiftedTraining.title}" rather than "${activeTraining.title}". Switch subject before drafting? (yes/no)`,
                },
              ]);
              setChatBusy(false);
              return;
            }
            shouldCheckShift = false;
          }

          if (needsIdeasResponse(activityText) || isIdeationPrompt(activityText)) {
            const topic = activeTraining.title;
            const options = await loadIdeaDirections(topic, activeTraining);
            setActivityPhase({ kind: "ideation", topic, options });
            setMessages((prev) => [
              ...prev,
              {
                id: nextId(),
                role: "assistant",
                text: buildBroadIntentMessage(topic, options),
                directionOptions: options,
              },
            ]);
            setChatBusy(false);
            return;
          }

          if (isBroadIntent(activityText)) {
            setActivityPhase({ kind: "await_readiness", topic: activityText });
            setMessages((prev) => [
              ...prev,
              { id: nextId(), role: "assistant", text: buildBroadTopicDecisionMessage(activityText) },
            ]);
            setChatBusy(false);
            return;
          }
        }
      }

      if (shouldCheckShift && activeTraining) {
        const shiftedTraining = await findSubjectShift(generationDescription, activeTraining, trainings);
        if (shiftedTraining) {
          setPendingTrainingSwitch({
            toTrainingId: shiftedTraining.id,
            toTrainingTitle: shiftedTraining.title,
            queuedIntent: generationDescription,
          });
          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              role: "assistant",
              text: `This sounds like "${shiftedTraining.title}" rather than "${activeTraining.title}". Switch subject before drafting? (yes/no)`,
            },
          ]);
          setChatBusy(false);
          return;
        }
      }

      if (
        selectedContentType === "activity"
        && extractPastedQuestionBatch(generationDescription)
      ) {
        const questions = extractPastedQuestionBatch(generationDescription) ?? [];
        if (questions.length > 10) {
          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              role: "assistant",
              text: `I found ${questions.length} questions. Split this into batches of 10 or fewer so each set can be reviewed and assigned intentionally. Nothing was saved.`,
            },
          ]);
          setChatBusy(false);
          return;
        }
        setPendingQuestionBatch({ questions, stage: "confirm" });
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            text: `I found ${questions.length} separate questions. Do they all belong in the same activity group? Reply yes or no. Nothing will be saved until you confirm.`,
          },
        ]);
        setChatBusy(false);
        return;
      }

      if (
        selectedContentType === "activity"
        && requestsMultipleQuestions(generationDescription)
      ) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            text: "Multi-question generation needs a confirmed activity group so every question has one destination. Choose an existing group below and use “Add question here.” If you need a new group, draft one exploratory question first, then create and assign its group before asking for more.",
          },
        ]);
        setChatBusy(false);
        return;
      }

      const created = await apiFetch<CreateDraftResponse>(
        "/api/thinkertools-missions-create/drafts",
        {
          method: "POST",
          body: JSON.stringify({
            contentType: selectedContentType,
            primaryTrainingId: activeTraining.id,
            activityGroupId: null,
            title: selectedContentType === "activity" ? activeTraining.title : undefined,
          }),
        },
      );
      const draftId = created.draft.id;

      await apiFetch(
        `/api/thinkertools-missions-create/drafts/${draftId}/generate`,
        { method: "POST", body: JSON.stringify({ description: generationDescription }) },
      );

      router.push(`/thinkertools-missions-create/drafts/${draftId}?from=${encodeURIComponent(generationDescription)}`);
    } catch (err) {
      const msg = isApiRequestError(err) ? err.message : "Something went wrong.";
      setChatError(msg);
      setMessages((prev) => [...prev, { id: nextId(), role: "assistant", text: `Sorry — ${msg}` }]);
      setChatBusy(false);
    }
  }

  // ── Manual form create ────────────────────────────────────────────────────
  async function handleFormCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const manualTraining = manualTrainings.find((training) => training.id === manualTrainingId);
    if (!manualTraining) {
      setFormError("Choose a subject before creating a manual draft.");
      return;
    }
    setFormCreating(true); setFormError(null);
    try {
      const result = await apiFetch<CreateDraftResponse>(
        "/api/thinkertools-missions-create/drafts",
        {
          method: "POST",
          body: JSON.stringify({
            contentType: formContentType,
            primaryTrainingId: manualTraining.id,
            activityGroupId: null,
            title: formTitle.trim() || undefined,
          }),
        },
      );
      router.push(`/thinkertools-missions-create/drafts/${result.draft.id}`);
    } catch (err) {
      setFormError(isApiRequestError(err) ? err.message : "Failed to create draft.");
      setFormCreating(false);
    }
  }

  async function handleAddQuestionHere(group: AuthoringActivityGroup) {
    if (!selectedTraining) {
      throw new Error("Choose a subject before adding a question.");
    }
    router.push(
      `/thinkertools-missions-create/drafts/new?trainingId=${encodeURIComponent(selectedTraining.id)}&activityGroupId=${encodeURIComponent(group.id)}`,
    );
  }

  function handlePageKeyDown(event: KeyboardEvent<HTMLElement>) {
    const target = event.target as HTMLElement | null;

    if (selectedTraining && step === "format") {
      if (target?.closest("input,select,textarea,[contenteditable='true']")) {
        return;
      }

      if (event.key === "Enter") {
        if (
          event.shiftKey ||
          event.metaKey ||
          event.ctrlKey ||
          event.altKey ||
          event.nativeEvent.isComposing
        ) {
          return;
        }

        const focusedFormatButton = target?.closest<HTMLButtonElement>("[data-format-option]");
        if (target?.closest("button,a") && !focusedFormatButton) {
          return;
        }

        event.preventDefault();
        void selectFormat((focusedFormatButton?.dataset.formatOption as DraftContentType | undefined) ?? activeFormatOption);
        return;
      }

      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        const currentIndex = FORMAT_OPTIONS.indexOf(activeFormatOption);
        const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
        const nextOption = FORMAT_OPTIONS[(currentIndex + direction + FORMAT_OPTIONS.length) % FORMAT_OPTIONS.length];

        setActiveFormatOption(nextOption);
        const nextButton = nextOption === "activity" ? activityFormatButtonRef.current : missionFormatButtonRef.current;
        nextButton?.focus();
        return;
      }
    }

    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }

    if (target?.closest("button,a,select,textarea,[contenteditable='true']")) {
      return;
    }

    if (target?.closest("form")) {
      return;
    }

    if (step === "subject" && newTrainingTitle.trim() && !creatingTraining) {
      event.preventDefault();
      trainingFormRef.current?.requestSubmit();
      return;
    }

    if (selectedTraining && step === "describe" && chatInput.trim() && !chatBusy) {
      event.preventDefault();
      chatFormRef.current?.requestSubmit();
      return;
    }

  }

  const manualDraftForm = (
    <form
      ref={manualFormRef}
      onSubmit={handleFormCreate}
      className="space-y-4 bg-slate-50/60 px-5 py-5"
    >
      <div>
        <h2 className="text-sm font-semibold text-slate-700">Manual draft</h2>
        <p className="mt-1 text-xs text-slate-500">
          Skip chat and open a blank draft directly in the editor.
        </p>
      </div>
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        <span className="font-medium">Subject</span>
        <select
          value={manualTrainingId}
          onChange={(event) => {
            setManualTrainingId(event.target.value);
            setFormError(null);
          }}
          disabled={formCreating || loadingTrainings}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none disabled:opacity-60"
        >
          <option value="">Choose a subject…</option>
          {manualTrainings.map((training) => (
            <option key={training.id} value={training.id}>
              {training.title}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        <span className="font-medium">Content type</span>
        <select
          value={formContentType}
          onChange={(event) => setFormContentType(event.target.value as DraftContentType)}
          disabled={formCreating}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none disabled:opacity-60"
        >
          <option value="activity">Quick practice questions (Activity)</option>
          <option value="mission">Story-based mission (Mission)</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        <span className="font-medium">
          Title <span className="font-normal text-slate-400">(optional)</span>
        </span>
        <input
          type="text"
          value={formTitle}
          onChange={(event) => setFormTitle(event.target.value)}
          disabled={formCreating}
          placeholder="Untitled"
          maxLength={300}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none disabled:opacity-60"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={formCreating || !manualTrainingId}
          className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
        >
          {formCreating ? "Creating…" : "Create blank draft"}
        </button>
        {formError ? <span className="text-xs text-rose-600">{formError}</span> : null}
      </div>
    </form>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!authChecked) return null;

  if (authError) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-sm text-amber-800">You need to be signed in. Use the Account menu to sign in.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6" onKeyDown={handlePageKeyDown}>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Content Authoring</h1>
      </header>

      <div className="mb-10 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          {selectedTraining ? (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { setSelectedTraining(null); setSelectedContentType(null); setActivityPhase({ kind: "idle" }); setPendingTrainingSwitch(null); setStep("subject"); setMessages([]); }} className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Go back">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M17 10a.75.75 0 00-.75-.75H5.612l4.158-3.96a.75.75 0 10-1.04-1.08l-5.5 5.25a.75.75 0 000 1.08l5.5 5.25a.75.75 0 101.04-1.08L5.612 10.75H16.25A.75.75 0 0017 10z" clipRule="evenodd" /></svg>
              </button>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{selectedTraining.title}</span>
            </div>
          ) : (
            <p className="text-xs font-medium text-slate-500">Start authoring</p>
          )}
          {selectedTraining ? <p className="text-xs text-slate-500">Choose either authoring path below.</p> : null}
        </div>

        {/* ── STEP 1: Subject ────────────────────────────────────────────── */}
        {step === "subject" ? (
          <div className="grid md:grid-cols-2">
            <section className="min-w-0 border-b border-slate-100 md:border-b-0 md:border-r">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-700">Guided authoring</h2>
              <p className="text-sm font-medium text-slate-800">What subject are you teaching?</p>
              <p className="mt-0.5 text-xs text-slate-400">Pick an existing track or create a new one.</p>
            </div>
            <div className="px-5 py-4">
              {loadingTrainings ? <p className="text-sm text-slate-400">Loading…</p> : (
                <>
                  {pickerTrainings.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {pickerTrainings.map((t) => (
                        <button key={t.id} type="button" onClick={() => selectTraining(t)} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-sm text-slate-700 hover:border-slate-400 hover:bg-white transition-colors">{t.title}</button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No published tracks yet. Create one below to get started.</p>
                  )}
                </>
              )}
            </div>
            <div className="border-t border-slate-100 px-5 py-4">
              <p className="mb-2 text-xs font-medium text-slate-500">New subject</p>
              <form ref={trainingFormRef} onSubmit={handleCreateTraining} className="flex gap-2">
                <input type="text" value={newTrainingTitle} onChange={(e) => setNewTrainingTitle(e.target.value)} disabled={creatingTraining} placeholder="e.g. Chemistry, Economics, Media Literacy…" maxLength={200} className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none disabled:opacity-60" />
                <button type="submit" disabled={creatingTraining || !newTrainingTitle.trim()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40">{creatingTraining ? "Creating…" : "Create"}</button>
              </form>
              {trainingError ? <p className="mt-2 text-xs text-rose-600">{trainingError}</p> : null}
            </div>
            </section>
            {manualDraftForm}
          </div>
        ) : null}

        {/* ── STEPS 2–4: Chat flow ───────────────────────────────────────── */}
        {selectedTraining ? (
          <div className="grid md:grid-cols-2">
            <section className="min-w-0 border-b border-slate-100 md:border-b-0 md:border-r">
              <div className="border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-700">AI-assisted draft</h2>
                <p className="mt-0.5 text-xs text-slate-500">Use chat for guided question or mission creation.</p>
              </div>
            <div ref={chatMessagesRef} className="max-h-[420px] space-y-4 overflow-y-auto px-4 py-4">
              {messages.map((msg) => (
                <div key={msg.id}>
                  <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.role === "user" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-800"}`}>
                      <p className="whitespace-pre-line">{msg.text}</p>
                      {msg.directionOptions ? (
                        <ol className="mt-3 space-y-2">
                          {msg.directionOptions.map((option) => (
                            <li key={option.id} className="flex gap-2">
                              <span className="mt-px w-4 shrink-0 text-xs font-semibold leading-snug text-slate-500">
                                {option.id}.
                              </span>
                              <div className="min-w-0">
                                <p className="font-semibold leading-snug text-slate-900">{option.label}</p>
                                <p className="mt-0.5 text-xs leading-snug text-slate-600">{option.prompt}</p>
                              </div>
                            </li>
                          ))}
                        </ol>
                      ) : null}
                    </div>
                  </div>

                  {/* Format choice buttons */}
                  {msg.formatChoice && step === "format" ? (
                    <div className="mt-3 flex gap-3 pl-1">
                      <button
                        ref={activityFormatButtonRef}
                        type="button"
                        data-format-option="activity"
                        onClick={() => void selectFormat("activity")}
                        onFocus={() => setActiveFormatOption("activity")}
                        aria-pressed={activeFormatOption === "activity"}
                        className={`flex-1 rounded-xl border-2 px-4 py-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 ${activeFormatOption === "activity" ? "border-slate-900 bg-slate-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50"}`}
                      >
                        <p className="text-sm font-semibold text-slate-800">Quick practice questions</p>
                        <p className="mt-0.5 text-xs text-slate-500">Short practice questions learners can do in minutes</p>
                      </button>
                      <button
                        ref={missionFormatButtonRef}
                        type="button"
                        data-format-option="mission"
                        onClick={() => void selectFormat("mission")}
                        onFocus={() => setActiveFormatOption("mission")}
                        aria-pressed={activeFormatOption === "mission"}
                        className={`flex-1 rounded-xl border-2 px-4 py-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 ${activeFormatOption === "mission" ? "border-slate-900 bg-slate-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50"}`}
                      >
                        <p className="text-sm font-semibold text-slate-800">Story-based mission</p>
                        <p className="mt-0.5 text-xs text-slate-500">A multi-stage narrative where learners investigate and resolve a case</p>
                      </button>
                    </div>
                  ) : null}

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

            {pendingQuestionBatch?.stage === "choose_group" ? (
              <div className="space-y-3 border-t border-amber-200 bg-amber-50/70 px-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-amber-950">
                    Place {pendingQuestionBatch.questions.length} questions together
                  </p>
                  <p className="mt-1 text-xs text-amber-800">
                    Creating the batch requires one teacher-confirmed activity group.
                  </p>
                </div>
                <div className="flex min-w-0 gap-2">
                  <label className="sr-only" htmlFor="batch-activity-group">Existing activity group</label>
                  <select
                    id="batch-activity-group"
                    value={batchActivityGroupId}
                    onChange={(event) => {
                      setBatchActivityGroupId(event.target.value);
                      setBatchError(null);
                    }}
                    disabled={chatBusy || loadingGroups || groups.length === 0}
                    className="min-w-0 flex-1 rounded-md border border-amber-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-400 focus:outline-none disabled:opacity-60"
                  >
                    <option value="">
                      {loadingGroups
                        ? "Loading groups…"
                        : groups.length === 0
                          ? "No existing groups"
                          : "Choose an existing group…"}
                    </option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>{group.title}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void createConfirmedQuestionBatch(batchActivityGroupId)}
                    disabled={chatBusy || !batchActivityGroupId}
                    className="shrink-0 rounded-md bg-amber-900 px-3 py-2 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-40"
                  >
                    Create batch
                  </button>
                </div>
                <div className="flex min-w-0 gap-2">
                  <label className="sr-only" htmlFor="new-batch-activity-group">New activity group name</label>
                  <input
                    id="new-batch-activity-group"
                    type="text"
                    value={newBatchActivityGroupTitle}
                    onChange={(event) => {
                      setNewBatchActivityGroupTitle(event.target.value);
                      setBatchError(null);
                    }}
                    disabled={chatBusy}
                    maxLength={200}
                    placeholder="Or name a new group…"
                    className="min-w-0 flex-1 rounded-md border border-amber-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => void handleCreateBatchActivityGroup()}
                    disabled={chatBusy || !newBatchActivityGroupTitle.trim()}
                    className="shrink-0 rounded-md border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-40"
                  >
                    Create group & batch
                  </button>
                </div>
                {batchError ? <p className="text-xs text-rose-700">{batchError}</p> : null}
              </div>
            ) : null}

            {/* Chat input */}
            {step === "describe" ? (
              <>
                <form ref={chatFormRef} onSubmit={handleChatSubmit} className="border-t border-slate-100 px-4 py-3 flex gap-2">
                  <textarea
                    ref={chatInputRef}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={chatBusy || pendingQuestionBatch?.stage === "choose_group"}
                    rows={2}
                    placeholder={
                      selectedContentType === "mission"
                        ? "Describe the scenario, setting, and conflict…"
                        : pendingTrainingSwitch
                          ? "Reply yes or no to switch subject…"
                        : pendingQuestionBatch?.stage === "choose_group"
                          ? "Choose an activity group above to continue…"
                        : activityPhase.kind === "await_readiness"
                          ? "Say: I have ideas, need ideas, or share a focus…"
                        : activityPhase.kind === "await_focus"
                          ? "Share one example question or short focus…"
                        : activityPhase.kind === "ideation"
                          ? `Pick 1-${activityPhase.options.length}, or type your own focus…`
                          : "Paste a question, name a topic, or say you’re not sure…"
                    }
                    className="min-h-11 flex-1 resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none disabled:opacity-60"
                  />
                  <button type="submit" disabled={chatBusy || pendingQuestionBatch?.stage === "choose_group" || !chatInput.trim()} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40">
                    {chatBusy ? "Creating…" : "Create"}
                  </button>
                </form>
                {chatError ? <p className="px-4 pb-3 text-xs text-rose-600">{chatError}</p> : null}
              </>
            ) : null}
            </section>
            {manualDraftForm}
          </div>
        ) : null}
      </div>

      {/* Subject workspace */}
      {selectedTraining ? (
        <SubjectWorkspace
          training={selectedTraining}
          groups={groups}
          uncategorized={uncategorized}
          drafts={drafts}
          loadingGroups={loadingGroups}
          groupsError={groupsError}
          loadingDrafts={loadingDrafts}
          draftsError={fetchError}
          onAddQuestion={handleAddQuestionHere}
        />
      ) : (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-600">Your drafts</h2>
          {loadingDrafts ? <p className="text-sm text-slate-400">Loading…</p> : fetchError ? <p className="text-sm text-rose-600">{fetchError}</p> : <DraftList drafts={drafts} trainings={draftTrainings} onResumeTraining={resumeTraining} />}
        </section>
      )}
      {selectedTraining ? <ActivityGroupsJumpLink /> : null}
    </main>
  );
}
