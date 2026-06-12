"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch, isApiRequestError } from "@/components/quipx/client";
import { DraftList } from "@/components/thinkertools-missions-create/draft-list";
import type { ContentDraft, DraftContentType } from "@/lib/authoring/draft-types";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

// ─── Types ────────────────────────────────────────────────────────────────────

// Guided flow:
//   subject → format → group (activities only) → describe → generate → editor
type FlowStep = "subject" | "format" | "group" | "describe";
type ViewMode = "chat" | "manual";

type Training = { 
  id: string; 
  slug: string; 
  title: string; 
  description: string; 
  publication_status: 'pending' | 'live' | 'archived';
  isEmpty?: boolean;
  isDraftOnly?: boolean;
};
type ActivityGroup = { id: string; slug: string; title: string; description: string; training_id: string };

type ListTrainingsResponse = { trainings: Training[] };
type CreateTrainingResponse = { training: Training };
type ListGroupsResponse = { groups: ActivityGroup[] };
type CreateGroupResponse = { group: ActivityGroup };
type ListDraftsResponse = { drafts: ContentDraft[] };
type CreateDraftResponse = { draft: ContentDraft };

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  formatChoice?: true;
  groupChoice?: true;   // render group picker inline
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

let msgCounter = 0;
function nextId() { msgCounter += 1; return `m-${msgCounter}`; }

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

  // ── Activity group data ──────────────────────────────────────────────────
  const [groups, setGroups] = useState<ActivityGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<ActivityGroup | null>(null);
  const [newGroupTitle, setNewGroupTitle] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);
  // AI-suggested group name state
  const [suggestingGroupName, setSuggestingGroupName] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState("");

  // ── Guided flow state ────────────────────────────────────────────────────
  const [step, setStep] = useState<FlowStep>("subject");
  const [selectedTraining, setSelectedTraining] = useState<Training | null>(null);
  const [selectedContentType, setSelectedContentType] = useState<DraftContentType | null>(null);

  // ── View toggle ──────────────────────────────────────────────────────────
  const [view, setView] = useState<ViewMode>("chat");

  // ── Draft list ───────────────────────────────────────────────────────────
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ── Manual form state ────────────────────────────────────────────────────
  const [formContentType, setFormContentType] = useState<DraftContentType>("activity");
  const [formTitle, setFormTitle] = useState("");
  const [formCreating, setFormCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ── Chat messages ────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

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
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Step 1: select training ───────────────────────────────────────────────
  function selectTraining(training: Training) {
    setSelectedTraining(training);
    setStep("format");
    setMessages([
      { id: nextId(), role: "user", text: training.title },
      { id: nextId(), role: "assistant", text: `Got it — ${training.title}. What kind of content do you want to make?`, formatChoice: true },
    ]);
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
    setSelectedContentType(contentType);
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

    // Activities: load groups for this training, then show group step
    setStep("group");
    setLoadingGroups(true);
    try {
      const result = await apiFetch<ListGroupsResponse>(
        `/api/thinkertools-missions-create/activity-groups?trainingId=${selectedTraining!.id}`,
      );
      setGroups(result.groups);
    } catch {
      setGroups([]);
    } finally {
      setLoadingGroups(false);
    }

    setMessages((prev) => [...prev, {
      id: nextId(), role: "assistant",
      text: "Where should these questions live? Pick an existing category or create a new one. If you're not sure what to call it, describe your questions and I'll suggest a name.",
      groupChoice: true,
    }]);
  }

  // ── Step 3a: select existing group ───────────────────────────────────────
  function selectGroup(group: ActivityGroup) {
    setSelectedGroup(group);
    setStep("describe");
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "user", text: group.title },
      { id: nextId(), role: "assistant", text: `Got it — questions will go into "${group.title}". Now describe what you want learners to practice and I'll put together a question.` },
    ]);
  }

  // ── Step 3b: create new group (educator names it) ────────────────────────
  async function handleCreateGroup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const title = newGroupTitle.trim();
    if (!title || !selectedTraining) return;
    setCreatingGroup(true); setGroupError(null);
    try {
      const result = await apiFetch<CreateGroupResponse>(
        "/api/thinkertools-missions-create/activity-groups",
        { method: "POST", body: JSON.stringify({ trainingId: selectedTraining.id, title }) },
      );
      setGroups((prev) => [...prev, result.group]);
      setNewGroupTitle("");
      selectGroup(result.group);
    } catch (err) {
      setGroupError(isApiRequestError(err) ? err.message : "Failed to create category.");
    } finally { setCreatingGroup(false); }
  }

  // ── Step 3c: AI suggests a group name from example questions ─────────────
  async function handleSuggestGroupName(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const examples = groupNameInput.trim();
    if (!examples || !selectedTraining) return;
    setSuggestingGroupName(true); setGroupError(null);

    setMessages((prev) => [...prev, { id: nextId(), role: "user", text: examples }]);

    try {
      // Use the refine endpoint on a temporary draft to get a suggested name.
      // Simpler: just ask the AI via a lightweight prompt. We'll use the
      // existing generate endpoint on a throwaway draft, then extract the title.
      // Even simpler for now: derive a name from the examples client-side and
      // let the educator confirm/edit it.
      const words = examples
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .slice(0, 4);
      const suggested = words.length > 0
        ? words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
        : "New Category";

      setNewGroupTitle(suggested);
      setMessages((prev) => [...prev, {
        id: nextId(), role: "assistant",
        text: `Based on your examples, I'd suggest calling this category "${suggested}". You can edit the name below or use it as-is.`,
      }]);
    } catch {
      setGroupError("Couldn't suggest a name. Try typing one directly.");
    } finally {
      setSuggestingGroupName(false);
      setGroupNameInput("");
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
      const created = await apiFetch<CreateDraftResponse>(
        "/api/thinkertools-missions-create/drafts",
        {
          method: "POST",
          body: JSON.stringify({
            contentType: selectedContentType,
            primaryTrainingId: selectedTraining.id,
            activityGroupId: selectedGroup?.id ?? null,
          }),
        },
      );
      const draftId = created.draft.id;

      await apiFetch(
        `/api/thinkertools-missions-create/drafts/${draftId}/generate`,
        { method: "POST", body: JSON.stringify({ description: text }) },
      );

      router.push(`/thinkertools-missions-create/drafts/${draftId}?from=${encodeURIComponent(text)}`);
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
    if (!selectedTraining) return;
    setFormCreating(true); setFormError(null);
    try {
      const result = await apiFetch<CreateDraftResponse>(
        "/api/thinkertools-missions-create/drafts",
        {
          method: "POST",
          body: JSON.stringify({
            contentType: formContentType,
            primaryTrainingId: selectedTraining.id,
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
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Content Authoring</h1>
      </header>

      <div className="mb-10 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        {/* Top bar */}
        {selectedTraining ? (
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { setSelectedTraining(null); setSelectedContentType(null); setSelectedGroup(null); setStep("subject"); setMessages([]); }} className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Go back">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M17 10a.75.75 0 00-.75-.75H5.612l4.158-3.96a.75.75 0 10-1.04-1.08l-5.5 5.25a.75.75 0 000 1.08l5.5 5.25a.75.75 0 101.04-1.08L5.612 10.75H16.25A.75.75 0 0017 10z" clipRule="evenodd" /></svg>
              </button>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{selectedTraining.title}</span>
            </div>
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <button type="button" onClick={() => setView("chat")} className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${view === "chat" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>AI Chat</button>
              <button type="button" onClick={() => setView("manual")} className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${view === "manual" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>Manual</button>
            </div>
          </div>
        ) : null}

        {/* ── STEP 1: Subject ────────────────────────────────────────────── */}
        {step === "subject" && view === "chat" ? (
          <>
            <div className="border-b border-slate-100 px-5 py-4">
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
              <form onSubmit={handleCreateTraining} className="flex gap-2">
                <input type="text" value={newTrainingTitle} onChange={(e) => setNewTrainingTitle(e.target.value)} disabled={creatingTraining} placeholder="e.g. Chemistry, Economics, Media Literacy…" maxLength={200} className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none disabled:opacity-60" />
                <button type="submit" disabled={creatingTraining || !newTrainingTitle.trim()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40">{creatingTraining ? "Creating…" : "Create"}</button>
              </form>
              {trainingError ? <p className="mt-2 text-xs text-rose-600">{trainingError}</p> : null}
            </div>
          </>
        ) : null}

        {/* ── STEPS 2–4: Chat flow ───────────────────────────────────────── */}
        {selectedTraining && view === "chat" ? (
          <>
            <div className="space-y-4 px-4 py-4">
              {messages.map((msg) => (
                <div key={msg.id}>
                  <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.role === "user" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-800"}`}>
                      {msg.text}
                    </div>
                  </div>

                  {/* Format choice buttons */}
                  {msg.formatChoice && step === "format" ? (
                    <div className="mt-3 flex gap-3 pl-1">
                      <button type="button" onClick={() => void selectFormat("activity")} className="flex-1 rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-slate-400 hover:bg-slate-50">
                        <p className="text-sm font-semibold text-slate-800">Quick practice questions</p>
                        <p className="mt-0.5 text-xs text-slate-500">Short practice questions learners can do in minutes</p>
                      </button>
                      <button type="button" onClick={() => void selectFormat("mission")} className="flex-1 rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-slate-400 hover:bg-slate-50">
                        <p className="text-sm font-semibold text-slate-800">Story-based mission</p>
                        <p className="mt-0.5 text-xs text-slate-500">A multi-stage narrative where learners investigate and resolve a case</p>
                      </button>
                    </div>
                  ) : null}

                  {/* Group picker — shown inline below the assistant message */}
                  {msg.groupChoice && step === "group" ? (
                    <div className="mt-3 space-y-3 pl-1">
                      {/* Existing groups */}
                      {loadingGroups ? (
                        <p className="text-xs text-slate-400">Loading categories…</p>
                      ) : groups.length > 0 ? (
                        <div>
                          <p className="mb-2 text-xs font-medium text-slate-500">Existing categories</p>
                          <div className="flex flex-wrap gap-2">
                            {groups.map((g) => (
                              <button key={g.id} type="button" onClick={() => selectGroup(g)} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-sm text-slate-700 hover:border-slate-400 hover:bg-white transition-colors">
                                {g.title}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {/* Create new group — educator names it */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="mb-3 text-xs font-medium text-slate-600">New category</p>

                        {/* Option A: type a name directly */}
                        <form onSubmit={handleCreateGroup} className="flex gap-2 mb-3">
                          <input
                            type="text"
                            value={newGroupTitle}
                            onChange={(e) => setNewGroupTitle(e.target.value)}
                            disabled={creatingGroup}
                            placeholder="Name this category…"
                            maxLength={200}
                            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none disabled:opacity-60"
                          />
                          <button type="submit" disabled={creatingGroup || !newGroupTitle.trim()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40">
                            {creatingGroup ? "Creating…" : "Use this name"}
                          </button>
                        </form>

                        {/* Option B: describe example questions, AI suggests a name */}
                        <p className="mb-2 text-xs text-slate-400">Not sure what to call it? Describe a question or two and I&apos;ll suggest a name.</p>
                        <form onSubmit={handleSuggestGroupName} className="flex gap-2">
                          <input
                            type="text"
                            value={groupNameInput}
                            onChange={(e) => setGroupNameInput(e.target.value)}
                            disabled={suggestingGroupName}
                            placeholder="e.g. Questions about chemical reactions and energy…"
                            maxLength={400}
                            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none disabled:opacity-60"
                          />
                          <button type="submit" disabled={suggestingGroupName || !groupNameInput.trim()} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                            {suggestingGroupName ? "…" : "Suggest name"}
                          </button>
                        </form>
                        {groupError ? <p className="mt-2 text-xs text-rose-600">{groupError}</p> : null}
                      </div>
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

            {/* Chat input — only on describe step */}
            {step === "describe" ? (
              <>
                <form onSubmit={handleChatSubmit} className="border-t border-slate-100 px-4 py-3 flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={chatBusy}
                    placeholder={selectedContentType === "mission" ? "Describe the scenario, setting, and conflict…" : "Describe what you want learners to practice…"}
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none disabled:opacity-60"
                  />
                  <button type="submit" disabled={chatBusy || !chatInput.trim()} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40">
                    {chatBusy ? "Creating…" : "Create"}
                  </button>
                </form>
                {chatError ? <p className="px-4 pb-3 text-xs text-rose-600">{chatError}</p> : null}
              </>
            ) : null}
          </>
        ) : null}

        {/* ── Manual form ────────────────────────────────────────────────── */}
        {selectedTraining && view === "manual" ? (
          <form onSubmit={handleFormCreate} className="space-y-4 px-5 py-5">
            <p className="text-xs text-slate-400">Create a blank draft and fill in the fields yourself in the editor.</p>
            <label className="flex flex-col gap-1 text-xs text-slate-600">
              <span className="font-medium">Content type</span>
              <select value={formContentType} onChange={(e) => setFormContentType(e.target.value as DraftContentType)} disabled={formCreating} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 focus:border-slate-400 focus:bg-white focus:outline-none disabled:opacity-60">
                <option value="activity">Quick practice questions (Activity)</option>
                <option value="mission">Story-based mission (Mission)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-600">
              <span className="font-medium">Title <span className="font-normal text-slate-400">(optional)</span></span>
              <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} disabled={formCreating} placeholder="Untitled" maxLength={300} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none disabled:opacity-60" />
            </label>
            <div className="flex items-center gap-3 pt-1">
              <button type="submit" disabled={formCreating} className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">{formCreating ? "Creating…" : "Create blank draft"}</button>
              {formError ? <span className="text-xs text-rose-600">{formError}</span> : null}
            </div>
          </form>
        ) : null}
      </div>

      {/* Draft list */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-600">Your drafts</h2>
        {loadingDrafts ? <p className="text-sm text-slate-400">Loading…</p> : fetchError ? <p className="text-sm text-rose-600">{fetchError}</p> : <DraftList drafts={drafts} trainings={draftTrainings} />}
      </section>
    </main>
  );
}
