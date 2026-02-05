"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ProbeRow = {
  table: "woi_games" | "quipx_sessions" | "comments";
  client: "anon" | "service-role";
  expected: {
    rule: "allow" | "deny-or-empty" | "contextual";
    label: string;
  };
  actual: {
    result: "rows" | "empty" | "error";
    rowCount: number | null;
    errorCode: string | null;
    errorMessage: string | null;
  };
  pass: boolean;
  note?: string;
};

type ProbePayload = {
  checkedAt: string;
  latencyMs: number;
  matrix: ProbeRow[];
};

type ProbeResponse =
  | {
      ok: true;
      data: ProbePayload;
    }
  | {
      ok: false;
      error: {
        message: string;
      };
    };

function formatActual(row: ProbeRow) {
  if (row.actual.result === "error") {
    const code = row.actual.errorCode ? `[${row.actual.errorCode}] ` : "";
    return `${code}${row.actual.errorMessage ?? "Unknown error"}`;
  }

  if (row.actual.result === "rows") {
    return `Rows visible (${row.actual.rowCount ?? 0})`;
  }

  return "No rows visible";
}

export default function RlsDebugPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ProbePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadProbe = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/debug/rls-probe", {
        cache: "no-store",
      });
      const payload = (await response.json()) as ProbeResponse;

      if (!response.ok || !payload.ok) {
        const message = payload.ok
          ? `Unexpected status ${response.status}`
          : payload.error.message;
        setError(message);
        setData(null);
        return;
      }

      setData(payload.data);
    } catch {
      setError("Failed to load RLS probe.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProbe();
  }, [loadProbe]);

  const hasFailures = useMemo(
    () => data?.matrix.some((row) => !row.pass) ?? false,
    [data],
  );

  return (
    <main className="mx-auto min-h-screen max-w-6xl p-6 md:p-10">
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">RLS Probe Debug</h1>
          <p className="text-sm text-zinc-600">
            Read-only checks for anon and service-role access across demo-critical tables.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadProbe()}
          className="rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50"
        >
          Refresh Probe
        </button>
      </header>

      {loading ? (
        <p className="text-sm text-zinc-600">Loading probe...</p>
      ) : null}

      {error ? (
        <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

      {data ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded border border-zinc-200 px-3 py-1">
              Checked: {new Date(data.checkedAt).toLocaleString()}
            </span>
            <span className="rounded border border-zinc-200 px-3 py-1">Latency: {data.latencyMs}ms</span>
            <span
              className={`rounded border px-3 py-1 ${
                hasFailures
                  ? "border-red-300 bg-red-50 text-red-700"
                  : "border-emerald-300 bg-emerald-50 text-emerald-700"
              }`}
            >
              {hasFailures ? "Failures detected" : "All checks passing"}
            </span>
          </div>

          <div className="overflow-x-auto rounded border border-zinc-200">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-zinc-100">
                <tr>
                  <th className="px-3 py-2 font-semibold">Table</th>
                  <th className="px-3 py-2 font-semibold">Client</th>
                  <th className="px-3 py-2 font-semibold">Expected</th>
                  <th className="px-3 py-2 font-semibold">Actual</th>
                  <th className="px-3 py-2 font-semibold">Pass/Fail</th>
                </tr>
              </thead>
              <tbody>
                {data.matrix.map((row) => (
                  <tr key={`${row.table}:${row.client}`} className="border-t border-zinc-200 align-top">
                    <td className="px-3 py-2 font-mono text-xs">{row.table}</td>
                    <td className="px-3 py-2">{row.client}</td>
                    <td className="px-3 py-2">{row.expected.label}</td>
                    <td className="px-3 py-2">
                      <div>{formatActual(row)}</div>
                      {row.note ? <div className="text-xs text-zinc-500">{row.note}</div> : null}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded px-2 py-1 text-xs font-semibold ${
                          row.pass
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {row.pass ? "PASS" : "FAIL"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-zinc-500">
            Comments policy is context-driven; inspect Expected and Actual together before demo.
          </p>
        </>
      ) : null}
    </main>
  );
}
