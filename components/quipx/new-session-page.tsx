"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { apiFetch, parseObject, parseString } from "@/components/quipx/client";
import { DataPanel, JsonView, QuipxShell } from "@/components/quipx/ui";

export function QuipxNewSessionPage() {
  const router = useRouter();
  const [teamId, setTeamId] = useState("10000000-0000-4000-8000-000000000001");
  const [subject, setSubject] = useState("Prepare product launch narrative");
  const [objectives, setObjectives] = useState("Audience: investors and early design partners.");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<unknown>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<unknown>("/api/quipx/sessions", {
        method: "POST",
        body: JSON.stringify({
          teamId: teamId.trim(),
          subject: subject.trim(),
          objectives: objectives.trim(),
        }),
      });
      setResponse(data);

      const parsed = parseObject(data);
      const sessionObject = parseObject(parsed?.session);
      const sessionId = parseString(
        sessionObject?.id ?? parsed?.sessionId ?? parsed?.id,
        "",
      );
      if (sessionId) {
        router.push(`/quipx/sessions/${sessionId}/discuss`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create session.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <QuipxShell
      title="Start New Session"
      subtitle="Creates a session through `/api/quipx/sessions` and routes to Discuss when a session id is returned."
    >
      <div className="grid gap-4">
        <DataPanel title="Session Setup">
          <form className="space-y-3" onSubmit={onSubmit}>
            <label className="grid gap-1 text-sm text-slate-700">
              Team ID (UUID)
              <input
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                required
              />
            </label>

            <label className="grid gap-1 text-sm text-slate-700">
              Subject
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                required
              />
            </label>

            <label className="grid gap-1 text-sm text-slate-700">
              Objectives
              <textarea
                value={objectives}
                onChange={(event) => setObjectives(event.target.value)}
                rows={4}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {loading ? "Creating..." : "Create Session"}
            </button>
          </form>

          {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
          {response ? (
            <p className="mt-3 text-sm text-slate-600">
              Session created. If no redirect happened, the API likely returned a non-standard id field.
            </p>
          ) : null}
        </DataPanel>

        {response ? (
          <DataPanel title="Create Response">
            <JsonView value={response} />
          </DataPanel>
        ) : null}
      </div>
    </QuipxShell>
  );
}
