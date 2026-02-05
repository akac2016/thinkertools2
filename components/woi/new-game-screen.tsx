"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { DemoUserField } from "@/components/shared/demo-user-field";
import {
  createGame,
  fetchActorTeams,
  fetchTemplates,
  type WoiGameSummary,
  type WoiTeamSummary,
  type WoiTemplateCatalogEntry,
} from "@/components/woi/client";
import { InlineMessage, WoiSection, WoiShell } from "@/components/woi/shell";

const TEAM_STORAGE_KEY = "woi-demo-team-id";

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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdGame, setCreatedGame] = useState<WoiGameSummary | null>(null);

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

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === teamId) ?? null,
    [teamId, teams],
  );
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === templateId) ?? null,
    [templateId, templates],
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

  const canSubmit = useMemo(() => {
    return Boolean(teamId.trim() && templateId.trim() && question.trim() && description.trim());
  }, [description, question, teamId, templateId]);

  const submit = async () => {
    setLoading(true);
    setError(null);
    setCreatedGame(null);

    try {
      const game = await createGame({
        teamId: teamId.trim(),
        templateId: templateId.trim(),
        question: question.trim(),
        description: description.trim(),
        isPublic,
      });

      setCreatedGame(game);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(TEAM_STORAGE_KEY, teamId.trim());
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
      subtitle="Create a WOI game using an existing template and launch the play loop."
    >
      <DemoUserField />

      <WoiSection title="Game Setup">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
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
              {teamsLoading ? (
                <p className="text-sm text-slate-500">Loading teams...</p>
              ) : null}
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
              {templatesLoading ? (
                <p className="text-sm text-slate-500">Loading templates...</p>
              ) : null}
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
            placeholder="Context and constraints for the team"
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

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              if (!canSubmit || loading) {
                return;
              }
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

        {createdGame ? (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <p>
              Game created: <span className="font-semibold">{createdGame.question}</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                href={`/woi/games/${createdGame.id}/play`}
                className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600"
              >
                Go to Play
              </Link>
              <Link
                href={`/woi/games/${createdGame.id}/reflect`}
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
