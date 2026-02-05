"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/components/quipx/client";
import { DataPanel, JsonView, PhaseNav, QuipxShell, StatusCard } from "@/components/quipx/ui";

type Phase = "reflect" | "improve" | "review";

const phaseMeta: Record<
  Phase,
  { title: string; subtitle: string; next: string | null; cta: string | null }
> = {
  reflect: {
    title: "Reflect",
    subtitle: "Inspect model feedback and signals before editing outputs.",
    next: "improve",
    cta: "Continue to Improve",
  },
  improve: {
    title: "Improve",
    subtitle: "Apply refinements and compare updated draft state.",
    next: "review",
    cta: "Continue to Review",
  },
  review: {
    title: "Review",
    subtitle: "Final check of session outcome, decisions, and exported state.",
    next: null,
    cta: null,
  },
};

export function QuipxPhasePage({
  phase,
  sessionId,
}: {
  phase: Phase;
  sessionId: string;
}) {
  const meta = phaseMeta[phase];
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInput, setActionInput] = useState("Polish clarity and tighten examples.");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionResponse, setActionResponse] = useState<unknown>(null);
  const [acting, setActing] = useState(false);

  const endpoint = useMemo(
    () => `/api/quipx/sessions/${sessionId}/${phase}`,
    [phase, sessionId],
  );

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);

      try {
        const response = await apiFetch<unknown>(endpoint);
        if (!active) {
          return;
        }

        setData(response);
        setError(null);
      } catch (err) {
        if (!active) {
          return;
        }

        const message = err instanceof Error ? err.message : `Unable to load ${phase}.`;
        setError(message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [endpoint, phase]);

  const runAction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActing(true);
    setActionError(null);

    try {
      const response = await apiFetch<unknown>(endpoint, {
        method: "POST",
        body: JSON.stringify({ note: actionInput }),
      });
      setActionResponse(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : `Unable to submit ${phase} action.`;
      setActionError(message);
    } finally {
      setActing(false);
    }
  };

  return (
    <QuipxShell title={meta.title} subtitle={meta.subtitle}>
      <PhaseNav sessionId={sessionId} />

      <div className="grid gap-4 lg:grid-cols-2">
        <DataPanel
          title={`${meta.title} Data`}
          right={
            meta.next && meta.cta ? (
              <Link
                href={`/quipx/sessions/${sessionId}/${meta.next}`}
                className="rounded-md bg-slate-900 px-3 py-1 text-sm font-medium text-white hover:bg-slate-700"
              >
                {meta.cta}
              </Link>
            ) : null
          }
        >
          {data ? (
            <JsonView value={data} />
          ) : (
            <StatusCard
              loading={loading}
              error={error}
              emptyLabel={`No ${phase} payload returned yet.`}
            />
          )}
        </DataPanel>

        <DataPanel title={`${meta.title} Action`}>
          <form className="grid gap-2" onSubmit={runAction}>
            <textarea
              rows={4}
              value={actionInput}
              onChange={(event) => setActionInput(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              placeholder={`Optional note for ${phase}`}
            />
            <button
              type="submit"
              disabled={acting}
              className="justify-self-start rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              {acting ? "Submitting..." : `Submit ${meta.title}`}
            </button>
          </form>

          {actionError ? <p className="mt-3 text-sm text-rose-700">{actionError}</p> : null}
          {actionResponse ? (
            <div className="mt-3">
              <JsonView value={actionResponse} />
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              Action requests are optional and gracefully show errors if the endpoint is read-only.
            </p>
          )}
        </DataPanel>
      </div>
    </QuipxShell>
  );
}
