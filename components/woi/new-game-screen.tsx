"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createGameWithSlots,
  fetchActorTeams,
  fetchTemplates,
  fetchWoiRosterPresets,
  searchWoiUsers,
  type WoiCreateWithSlotsResult,
  type WoiHumanSeatInstructionInput,
  type WoiRosterPreset,
  type WoiTeamSummary,
  type WoiTemplateCatalogEntry,
  type WoiUserSearchResult,
} from "@/components/woi/client";
import { InlineMessage, WoiSection, WoiShell } from "@/components/woi/shell";

const TEAM_STORAGE_KEY = "woi-demo-team-id";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type HumanSeatDraft = {
  mode: "platform_user" | "email" | "open";
  selectedUser: WoiUserSearchResult | null;
  platformQuery: string;
  platformResults: WoiUserSearchResult[];
  platformLoading: boolean;
  seatError: string | null;
  inviteEmail: string;
};

function createSeatDraft(): HumanSeatDraft {
  return {
    mode: "open",
    selectedUser: null,
    platformQuery: "",
    platformResults: [],
    platformLoading: false,
    seatError: null,
    inviteEmail: "",
  };
}

function toClampedInt(raw: string, min: number, max: number, fallback: number) {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function toSeatDraft(entry: WoiRosterPreset["entries"][number] | undefined): HumanSeatDraft {
  if (!entry) {
    return createSeatDraft();
  }

  if (entry.mode === "platform_user" && entry.userId) {
    return {
      mode: "platform_user",
      selectedUser: {
        id: entry.userId,
        name: entry.userName?.trim() || entry.userId,
        email: entry.userEmail ?? null,
        color: null,
      },
      platformQuery: entry.userName?.trim() || entry.userId,
      platformResults: [],
      platformLoading: false,
      seatError: null,
      inviteEmail: "",
    };
  }

  if (entry.mode === "email" && entry.email) {
    return {
      mode: "email",
      selectedUser: null,
      platformQuery: "",
      platformResults: [],
      platformLoading: false,
      seatError: null,
      inviteEmail: entry.email,
    };
  }

  return createSeatDraft();
}

export function WoiNewGameScreen() {
  const searchParams = useSearchParams();

  const [teamId, setTeamId] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [teams, setTeams] = useState<WoiTeamSummary[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);

  const [templateId, setTemplateId] = useState("");
  const [templateFilter, setTemplateFilter] = useState("");
  const [templates, setTemplates] = useState<WoiTemplateCatalogEntry[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const [totalPlayerSlots, setTotalPlayerSlots] = useState(2);
  const [aiPlayerSlots, setAiPlayerSlots] = useState(0);
  const [creatorRole, setCreatorRole] = useState<"player" | "viewer">("player");
  const [lobbyVisibility, setLobbyVisibility] = useState<"hidden" | "listed">("listed");
  const [joinLinkEnabled, setJoinLinkEnabled] = useState(true);

  const [humanSeatDrafts, setHumanSeatDrafts] = useState<HumanSeatDraft[]>([]);

  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [teamPreset, setTeamPreset] = useState<WoiRosterPreset | null>(null);
  const [savedPresets, setSavedPresets] = useState<WoiRosterPreset[]>([]);
  const [selectedSavedPresetId, setSelectedSavedPresetId] = useState("");
  const [appliedPresetId, setAppliedPresetId] = useState<string | null>(null);
  const [appliedPresetLabel, setAppliedPresetLabel] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<WoiCreateWithSlotsResult | null>(null);

  useEffect(() => {
    const loadOptions = async () => {
      setTeamsLoading(true);
      setTemplatesLoading(true);
      try {
        const [nextTeams, nextTemplates] = await Promise.all([
          fetchActorTeams(),
          fetchTemplates(),
        ]);

        setTeams(nextTeams);
        setTemplates(nextTemplates);

        const teamIdFromQuery = searchParams.get("teamId")?.trim() ?? "";
        const storedTeamId =
          typeof window !== "undefined"
            ? (window.localStorage.getItem(TEAM_STORAGE_KEY)?.trim() ?? "")
            : "";

        const preferredTeamId = [teamIdFromQuery, storedTeamId]
          .find((candidate) => Boolean(candidate) && nextTeams.some((team) => team.id === candidate))
          ?? nextTeams[0]?.id
          ?? "";

        if (preferredTeamId) {
          setTeamId(preferredTeamId);
        }
        if (nextTemplates[0]?.id) {
          setTemplateId(nextTemplates[0].id);
        }
      } catch (loadOptionsError) {
        setError(loadOptionsError instanceof Error ? loadOptionsError.message : "Failed to load setup options");
      } finally {
        setTeamsLoading(false);
        setTemplatesLoading(false);
      }
    };

    void loadOptions();
  }, [searchParams]);

  useEffect(() => {
    setAiPlayerSlots((previous) => Math.min(previous, Math.min(4, totalPlayerSlots)));
  }, [totalPlayerSlots]);

  const humanPlayerSlots = useMemo(
    () => Math.max(0, totalPlayerSlots - aiPlayerSlots),
    [aiPlayerSlots, totalPlayerSlots],
  );
  const creatorSeatOffset = creatorRole === "player" ? 1 : 0;
  const configurableHumanSeatCount = Math.max(0, humanPlayerSlots - creatorSeatOffset);

  useEffect(() => {
    setHumanSeatDrafts((previous) => {
      const next = previous.slice(0, configurableHumanSeatCount);
      while (next.length < configurableHumanSeatCount) {
        next.push(createSeatDraft());
      }
      return next;
    });
  }, [configurableHumanSeatCount]);

  useEffect(() => {
    if (!teamId.trim()) {
      setTeamPreset(null);
      setSavedPresets([]);
      setSelectedSavedPresetId("");
      setRosterError(null);
      return;
    }

    let isActive = true;
    setRosterLoading(true);
    setRosterError(null);

    void fetchWoiRosterPresets(teamId.trim())
      .then((result) => {
        if (!isActive) {
          return;
        }

        setTeamPreset(result.teamPreset);
        setSavedPresets(result.presets);
        setSelectedSavedPresetId((previous) => {
          if (previous && result.presets.some((preset) => preset.id === previous)) {
            return previous;
          }
          return result.presets[0]?.id ?? "";
        });
      })
      .catch((rosterLoadError) => {
        if (!isActive) {
          return;
        }
        setRosterError(rosterLoadError instanceof Error ? rosterLoadError.message : "Failed to load roster presets");
        setTeamPreset(null);
        setSavedPresets([]);
      })
      .finally(() => {
        if (isActive) {
          setRosterLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [teamId]);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === teamId) ?? null,
    [teamId, teams],
  );
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === templateId) ?? null,
    [templateId, templates],
  );
  const selectedSavedPreset = useMemo(
    () => savedPresets.find((preset) => preset.id === selectedSavedPresetId) ?? null,
    [savedPresets, selectedSavedPresetId],
  );

  const filteredTeams = useMemo(() => {
    const needle = teamFilter.trim().toLowerCase();
    if (!needle) {
      return teams;
    }
    return teams.filter((team) => team.name.toLowerCase().includes(needle));
  }, [teamFilter, teams]);

  const filteredTemplates = useMemo(() => {
    const needle = templateFilter.trim().toLowerCase();
    if (!needle) {
      return templates;
    }
    return templates.filter((template) => {
      const haystack = [template.name, template.category ?? "", template.objective]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [templateFilter, templates]);

  const creatorRoleError =
    creatorRole === "player" && humanPlayerSlots < 1
      ? "Creator cannot be a player when there are zero human seats."
      : null;

  const seatValidationError = useMemo(() => {
    for (let index = 0; index < humanSeatDrafts.length; index += 1) {
      const seat = humanSeatDrafts[index];
      if (seat.mode === "platform_user" && !seat.selectedUser?.id) {
        return `Seat ${index + 1 + creatorSeatOffset}: select a platform user.`;
      }
      if (seat.mode === "email" && !EMAIL_PATTERN.test(seat.inviteEmail.trim())) {
        return `Seat ${index + 1 + creatorSeatOffset}: provide a valid invite email.`;
      }
    }
    return null;
  }, [creatorSeatOffset, humanSeatDrafts]);

  const canSubmit = useMemo(() => {
    return Boolean(
      templateId.trim()
        && question.trim()
        && description.trim()
        && !creatorRoleError
        && !seatValidationError,
    );
  }, [creatorRoleError, description, question, seatValidationError, templateId]);

  const updateSeatDraft = useCallback((index: number, updater: (seat: HumanSeatDraft) => HumanSeatDraft) => {
    setHumanSeatDrafts((previous) => previous.map((seat, seatIndex) => (
      seatIndex === index ? updater(seat) : seat
    )));
    setAppliedPresetId(null);
    setAppliedPresetLabel(null);
  }, []);

  const runSeatSearch = useCallback(async (index: number) => {
    const seat = humanSeatDrafts[index];
    if (!seat) {
      return;
    }

    const query = seat.platformQuery.trim();
    if (query.length < 2) {
      updateSeatDraft(index, (previous) => ({
        ...previous,
        platformResults: [],
        seatError: "Enter at least 2 characters to search.",
      }));
      return;
    }

    updateSeatDraft(index, (previous) => ({
      ...previous,
      platformLoading: true,
      seatError: null,
    }));

    try {
      const results = await searchWoiUsers({
        query,
        limit: 8,
      });

      updateSeatDraft(index, (previous) => ({
        ...previous,
        platformLoading: false,
        platformResults: results,
        seatError: results.length === 0 ? "No matching users found." : null,
      }));
    } catch (searchError) {
      updateSeatDraft(index, (previous) => ({
        ...previous,
        platformLoading: false,
        platformResults: [],
        seatError: searchError instanceof Error ? searchError.message : "Failed to search users",
      }));
    }
  }, [humanSeatDrafts, updateSeatDraft]);

  const applyPreset = useCallback((preset: WoiRosterPreset, options: {
    presetId: string | null;
    label: string;
  }) => {
    setHumanSeatDrafts(
      Array.from({ length: configurableHumanSeatCount }, (_, index) => toSeatDraft(preset.entries[index])),
    );
    setAppliedPresetId(options.presetId);
    setAppliedPresetLabel(options.label);
    setCreatedResult(null);
    setError(null);
  }, [configurableHumanSeatCount]);

  const submit = async () => {
    if (!canSubmit || loading) {
      return;
    }

    const humanSeatsPayload: WoiHumanSeatInstructionInput[] = [];
    for (const seat of humanSeatDrafts) {
      if (seat.mode === "platform_user") {
        const userId = seat.selectedUser?.id?.trim() ?? "";
        if (!userId) {
          setError("Each platform seat must have a selected user.");
          return;
        }
        humanSeatsPayload.push({
          mode: "platform_user",
          invitedUserId: userId,
        });
      } else if (seat.mode === "email") {
        const email = seat.inviteEmail.trim();
        if (!EMAIL_PATTERN.test(email)) {
          setError("Each email seat must include a valid email address.");
          return;
        }
        humanSeatsPayload.push({
          mode: "email",
          invitedEmail: email,
        });
      } else {
        humanSeatsPayload.push({ mode: "open" });
      }
    }

    setLoading(true);
    setError(null);
    setCreatedResult(null);

    try {
      const result = await createGameWithSlots({
        templateId: templateId.trim(),
        teamId: teamId.trim() || undefined,
        question: question.trim(),
        description: description.trim(),
        isPublic,
        totalPlayerSlots,
        aiPlayerSlots,
        creatorRole,
        humanSeats: humanSeatsPayload,
        presetId: appliedPresetId ?? undefined,
        lobbyVisibility,
        joinLinkEnabled,
      });

      setCreatedResult(result);

      if (typeof window !== "undefined") {
        const normalizedTeamId = teamId.trim();
        if (normalizedTeamId) {
          window.localStorage.setItem(TEAM_STORAGE_KEY, normalizedTeamId);
        }
      }
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create game");
    } finally {
      setLoading(false);
    }
  };

  return (
    <WoiShell
      title="Create New Game"
      subtitle="Step 1: define the topic. Step 2: invite players and add AI opponents."
    >
      <WoiSection title="New Game Setup">
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
              1
            </span>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Define topic and context</h3>
              <p className="mt-1 text-sm text-slate-600">Choose team/template, then keep your question and description clear.</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div>
              <label className="text-sm text-slate-700">
                <span className="mb-1 block">Find team</span>
                <input
                  value={teamFilter}
                  onChange={(event) => setTeamFilter(event.target.value)}
                  placeholder="Search teams by name"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                />
              </label>
              <div className="mt-2 max-h-40 overflow-auto rounded-lg border border-slate-200 bg-white p-2">
                {teamsLoading ? <p className="text-sm text-slate-500">Loading teams...</p> : null}
                {!teamsLoading && filteredTeams.length === 0 ? (
                  <p className="text-sm text-slate-500">No teams found.</p>
                ) : null}
                {!teamsLoading && filteredTeams.length > 0 ? (
                  <ul className="space-y-2">
                    {filteredTeams.map((team) => (
                      <li key={team.id}>
                        <button
                          type="button"
                          onClick={() => setTeamId(team.id)}
                          className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                            team.id === teamId
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                          }`}
                        >
                          {team.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              {selectedTeam ? (
                <p className="mt-2 text-xs text-slate-600">
                  Selected team: <span className="font-semibold text-slate-900">{selectedTeam.name}</span>
                </p>
              ) : null}
            </div>

            <div>
              <label className="text-sm text-slate-700">
                <span className="mb-1 block">Find template</span>
                <input
                  value={templateFilter}
                  onChange={(event) => setTemplateFilter(event.target.value)}
                  placeholder="Search templates by name, category, or objective"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                />
              </label>
              <div className="mt-2 max-h-40 overflow-auto rounded-lg border border-slate-200 bg-white p-2">
                {templatesLoading ? <p className="text-sm text-slate-500">Loading templates...</p> : null}
                {!templatesLoading && filteredTemplates.length === 0 ? (
                  <p className="text-sm text-slate-500">No templates found.</p>
                ) : null}
                {!templatesLoading && filteredTemplates.length > 0 ? (
                  <ul className="space-y-2">
                    {filteredTemplates.map((template) => (
                      <li key={template.id}>
                        <button
                          type="button"
                          onClick={() => setTemplateId(template.id)}
                          className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                            template.id === templateId
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                          }`}
                        >
                          <span className="font-semibold">{template.name}</span>
                          <span className="block text-xs opacity-80">
                            {template.category ?? "uncategorized"} • {template.isPublic ? "Public" : "Private"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              {selectedTemplate ? (
                <p className="mt-2 text-xs text-slate-600">{selectedTemplate.objective}</p>
              ) : null}
            </div>
          </div>

          <label className="mt-3 block text-sm text-slate-700">
            <span className="mb-1 block">Question</span>
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="What are we trying to answer?"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            />
          </label>

          <label className="mt-3 block text-sm text-slate-700">
            <span className="mb-1 block">Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Context and constraints for the game"
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            />
          </label>

          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(event) => setIsPublic(event.target.checked)}
              className="size-4"
            />
            Make game public
          </label>
        </section>

        <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
              2
            </span>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Invite players / Add AI opponents</h3>
              <p className="mt-1 text-sm text-slate-600">
                Set total players, AI players, creator role, then configure each human seat.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
            <label className="text-sm text-slate-700">
              <span className="mb-1 block">Total players (1-20)</span>
              <input
                type="number"
                min={1}
                max={20}
                value={totalPlayerSlots}
                onChange={(event) => {
                  setTotalPlayerSlots(toClampedInt(event.target.value, 1, 20, totalPlayerSlots));
                  setCreatedResult(null);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
              />
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-1 block">AI players (0-4)</span>
              <input
                type="number"
                min={0}
                max={Math.min(4, totalPlayerSlots)}
                value={aiPlayerSlots}
                onChange={(event) => {
                  setAiPlayerSlots(toClampedInt(event.target.value, 0, Math.min(4, totalPlayerSlots), aiPlayerSlots));
                  setCreatedResult(null);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
              />
            </label>

            <fieldset className="text-sm text-slate-700">
              <legend className="mb-1 block">Creator role</legend>
              <div className="flex gap-2">
                <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                  <input
                    type="radio"
                    name="creator-role"
                    checked={creatorRole === "player"}
                    onChange={() => {
                      setCreatorRole("player");
                      setCreatedResult(null);
                    }}
                  />
                  Player
                </label>
                <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                  <input
                    type="radio"
                    name="creator-role"
                    checked={creatorRole === "viewer"}
                    onChange={() => {
                      setCreatorRole("viewer");
                      setCreatedResult(null);
                    }}
                  />
                  Viewer
                </label>
              </div>
            </fieldset>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
            <span className="rounded-full bg-slate-200 px-3 py-1">Human slots: {humanPlayerSlots}</span>
            <span className="rounded-full bg-slate-200 px-3 py-1">AI slots: {aiPlayerSlots}</span>
            <span className="rounded-full bg-slate-200 px-3 py-1">Configurable seats: {configurableHumanSeatCount}</span>
          </div>

          {creatorRole === "player" ? (
            <InlineMessage kind="info">
              You occupy one human seat as creator.
            </InlineMessage>
          ) : null}

          {creatorRoleError ? <InlineMessage kind="error">{creatorRoleError}</InlineMessage> : null}

          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">Autofill seats (optional)</p>
              {rosterLoading ? <span className="text-xs text-slate-500">Loading presets...</span> : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!teamPreset || rosterLoading || configurableHumanSeatCount === 0}
                onClick={() => {
                  if (!teamPreset) {
                    return;
                  }
                  applyPreset(teamPreset, {
                    presetId: null,
                    label: teamPreset.name,
                  });
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Use team roster
              </button>

              <select
                value={selectedSavedPresetId}
                onChange={(event) => setSelectedSavedPresetId(event.target.value)}
                className="min-w-60 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700"
              >
                <option value="">Choose saved roster preset</option>
                {savedPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={!selectedSavedPreset || rosterLoading || configurableHumanSeatCount === 0}
                onClick={() => {
                  if (!selectedSavedPreset) {
                    return;
                  }
                  applyPreset(selectedSavedPreset, {
                    presetId: selectedSavedPreset.id,
                    label: selectedSavedPreset.name,
                  });
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Apply saved preset
              </button>
            </div>
            {appliedPresetLabel ? (
              <p className="mt-2 text-xs text-slate-600">Applied autofill: {appliedPresetLabel}</p>
            ) : null}
            {rosterError ? <InlineMessage kind="error">{rosterError}</InlineMessage> : null}
          </div>

          <div className="mt-4 space-y-3">
            {configurableHumanSeatCount === 0 ? (
              <InlineMessage kind="info">No additional human seats to configure.</InlineMessage>
            ) : null}

            {humanSeatDrafts.map((seat, index) => {
              const seatNumber = index + 1 + creatorSeatOffset;
              return (
                <article key={`human-seat-${seatNumber}`} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">Human seat {seatNumber}</p>
                    <div className="flex flex-wrap gap-2">
                      {(["platform_user", "email", "open"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => {
                            updateSeatDraft(index, (previous) => {
                              if (mode === "platform_user") {
                                return {
                                  ...previous,
                                  mode,
                                  inviteEmail: "",
                                  seatError: null,
                                };
                              }
                              if (mode === "email") {
                                return {
                                  ...previous,
                                  mode,
                                  selectedUser: null,
                                  platformResults: [],
                                  seatError: null,
                                };
                              }
                              return {
                                ...previous,
                                mode,
                                selectedUser: null,
                                platformQuery: "",
                                platformResults: [],
                                inviteEmail: "",
                                seatError: null,
                              };
                            });
                          }}
                          className={`rounded-md border px-2 py-1 text-xs transition ${
                            seat.mode === mode
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {mode === "platform_user" ? "Platform user" : mode === "email" ? "Email invite" : "Open seat"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {seat.mode === "platform_user" ? (
                    <div className="mt-3 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <input
                          value={seat.platformQuery}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            updateSeatDraft(index, (previous) => ({
                              ...previous,
                              platformQuery: nextValue,
                              seatError: null,
                            }));
                          }}
                          placeholder="Search by name or email"
                          className="min-w-56 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            void runSeatSearch(index);
                          }}
                          disabled={seat.platformLoading}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {seat.platformLoading ? "Searching..." : "Search"}
                        </button>
                      </div>

                      {seat.selectedUser ? (
                        <p className="text-xs text-slate-600">
                          Selected: <span className="font-semibold text-slate-900">{seat.selectedUser.name}</span>
                          {seat.selectedUser.email ? ` (${seat.selectedUser.email})` : ""}
                        </p>
                      ) : null}

                      {seat.platformResults.length > 0 ? (
                        <ul className="max-h-36 space-y-1 overflow-auto rounded-lg border border-slate-200 p-2">
                          {seat.platformResults.map((user) => (
                            <li key={user.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  updateSeatDraft(index, (previous) => ({
                                    ...previous,
                                    selectedUser: user,
                                    platformQuery: user.name,
                                    platformResults: [],
                                    seatError: null,
                                  }));
                                }}
                                className="w-full rounded-md bg-slate-100 px-2 py-2 text-left text-xs text-slate-700 transition hover:bg-slate-200"
                              >
                                <span className="font-semibold text-slate-900">{user.name}</span>
                                {user.email ? <span className="block">{user.email}</span> : null}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}

                  {seat.mode === "email" ? (
                    <div className="mt-3">
                      <input
                        type="email"
                        value={seat.inviteEmail}
                        onChange={(event) => {
                          const nextEmail = event.target.value;
                          updateSeatDraft(index, (previous) => ({
                            ...previous,
                            inviteEmail: nextEmail,
                            seatError: null,
                          }));
                        }}
                        placeholder="invitee@example.com"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                      />
                    </div>
                  ) : null}

                  {seat.mode === "open" ? (
                    <p className="mt-3 text-xs text-slate-600">
                      This seat stays open and can be claimed from lobby/join link while seat claims are unlocked.
                    </p>
                  ) : null}

                  {seat.seatError ? <InlineMessage kind="error">{seat.seatError}</InlineMessage> : null}
                </article>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={lobbyVisibility === "listed"}
                onChange={(event) => setLobbyVisibility(event.target.checked ? "listed" : "hidden")}
                className="size-4"
              />
              List game in lobby while seats are open
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={joinLinkEnabled}
                onChange={(event) => setJoinLinkEnabled(event.target.checked)}
                className="size-4"
              />
              Enable join link on create
            </label>
          </div>

          {seatValidationError ? <InlineMessage kind="error">{seatValidationError}</InlineMessage> : null}
        </section>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              void submit();
            }}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={!canSubmit || loading}
          >
            {loading ? "Creating..." : "Create game"}
          </button>
          <Link
            href="/woi"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Back to games
          </Link>
        </div>

        {error ? <InlineMessage kind="error">{error}</InlineMessage> : null}

        {createdResult ? (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <p>
              Game created: <span className="font-semibold">{createdResult.game.question}</span>
            </p>
            <p className="mt-1 text-xs">
              Status: {createdResult.status} • Slots: {createdResult.slots.length} • Pending invites: {createdResult.inviteSummary.pending}
            </p>
            {createdResult.joinLink?.shareUrl ? (
              <p className="mt-1 text-xs">
                Join link: {" "}
                <a href={createdResult.joinLink.shareUrl} className="underline" target="_blank" rel="noreferrer">
                  {createdResult.joinLink.shareUrl}
                </a>
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                href={`/woi/games/${createdResult.game.id}`}
                className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600"
              >
                Go to Play
              </Link>
              <Link
                href={`/woi/games/${createdResult.game.id}?tab=reflect`}
                className="rounded-md border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
              >
                Open Reflect
              </Link>
            </div>
          </div>
        ) : null}
      </WoiSection>
    </WoiShell>
  );
}
