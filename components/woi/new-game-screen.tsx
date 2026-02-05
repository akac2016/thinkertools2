"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { DemoUserField } from "@/components/shared/demo-user-field";
import { createGame, type WoiGameSummary } from "@/components/woi/client";
import { InlineMessage, WoiSection, WoiShell } from "@/components/woi/shell";

const TEAM_STORAGE_KEY = "woi-demo-team-id";

export function WoiNewGameScreen() {
  const searchParams = useSearchParams();

  const [teamId, setTeamId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdGame, setCreatedGame] = useState<WoiGameSummary | null>(null);

  useEffect(() => {
    const teamIdFromQuery = searchParams.get("teamId")?.trim() ?? "";
    if (teamIdFromQuery) {
      setTeamId(teamIdFromQuery);
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const storedTeamId = window.localStorage.getItem(TEAM_STORAGE_KEY)?.trim() ?? "";
    if (storedTeamId) {
      setTeamId(storedTeamId);
    }
  }, [searchParams]);

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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm text-slate-700">
            <span className="mb-1 block">Team ID</span>
            <input
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
              placeholder="UUID team id"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            />
          </label>

          <label className="text-sm text-slate-700">
            <span className="mb-1 block">Template ID</span>
            <input
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
              placeholder="UUID template id"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            />
          </label>
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
