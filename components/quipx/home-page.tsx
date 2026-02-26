"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch, parseArray, parseObject, parseString } from "@/components/quipx/client";
import { DataPanel, JsonView, QuipxShell, StatusCard } from "@/components/quipx/ui";

type SessionPreview = {
  id: string;
  title: string;
  phase: string;
  raw: unknown;
};

function parseSessionItem(input: unknown, index: number): SessionPreview {
  const obj = parseObject(input) ?? {};
  const id = parseString(obj.sessionId ?? obj.id, `session-${index + 1}`);
  const title = parseString(obj.title ?? obj.topic, `Session ${index + 1}`);
  const phase = parseString(obj.phase ?? obj.status, "discuss");

  return { id, title, phase, raw: input };
}

export function QuipxHomePage() {
  const [sessions, setSessions] = useState<SessionPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await apiFetch<unknown>("/api/quipx/sessions");
        const list = parseArray(parseObject(data)?.sessions ?? data).map(parseSessionItem);
        setSessions(list);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load sessions.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  return (
    <QuipxShell
      title="Quipx Sessions"
      subtitle="Use the account panel in the top-right to sign in before creating or updating sessions."
    >
      <div className="grid gap-4">
        <DataPanel
          title="Authentication"
        >
          <p className="text-sm text-slate-600">
            Supabase Auth is enabled. Sign in or create an account from the top-right panel.
          </p>
        </DataPanel>

        <DataPanel
          title="Start"
          right={
            <Link
              href="/quipx/sessions/new"
              className="rounded-md bg-slate-900 px-3 py-1 text-sm font-medium text-white hover:bg-slate-700"
            >
              New Session
            </Link>
          }
        >
          <p className="text-sm text-slate-600">
            Existing sessions are listed below when `/api/quipx/sessions` is available.
          </p>
        </DataPanel>

        <DataPanel title="Existing Sessions">
          {sessions.length > 0 ? (
            <ul className="space-y-2">
              {sessions.map((session) => (
                <li
                  key={session.id}
                  className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-slate-900">{session.title}</p>
                    <p className="text-xs text-slate-500">{session.id} • {session.phase}</p>
                  </div>
                  <Link
                    href={`/quipx/sessions/${session.id}/discuss`}
                    className="rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <StatusCard loading={loading} error={error} emptyLabel="No sessions returned yet." />
          )}
        </DataPanel>

        {sessions.length > 0 ? (
          <DataPanel title="Raw Sessions Payload">
            <JsonView value={sessions.map((session) => session.raw)} />
          </DataPanel>
        ) : null}
      </div>
    </QuipxShell>
  );
}
