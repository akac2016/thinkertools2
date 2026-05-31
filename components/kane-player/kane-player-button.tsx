"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

import styles from "./kane-player-button.module.css";

type KaneStep = {
  step: number;
  status: "passed" | "failed" | string;
  remark: string;
};

type Phase = "activity" | "mission";

type KanePlayerState =
  | { phase: "idle" }
  | { phase: "running"; runPhase: Phase; steps: KaneStep[]; attached: boolean | null }
  | { phase: "done"; runPhase: Phase; status: string; summary: string; duration: number; steps: KaneStep[]; attached: boolean | null }
  | { phase: "error"; runPhase: Phase; message: string; steps: KaneStep[]; attached: boolean | null };

type Props = {
  /** Called after each Kane step completes — use to refresh page state */
  onStep?: () => void;
};

async function authHeaders(json = false): Promise<Record<string, string>> {
  const supabase = getSupabaseBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {};
  if (json) headers["Content-Type"] = "application/json";
  if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;
  return headers;
}

export function KanePlayerButton({ onStep }: Props) {
  const [state, setState] = useState<KanePlayerState>({ phase: "idle" });
  // Independent of the SSE stream: reflects whether the SERVER says Kane is
  // running. Survives page reloads (which happen when Kane navigates the tab).
  const [serverRunning, setServerRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Poll the server for run status. This is what makes Stop reload-proof:
  // after a reload, the component remounts and learns Kane is still running.
  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const checkStatus = async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch("/api/kane-player/status", { headers, cache: "no-store" });
        if (!res.ok) return;
        const body = await res.json() as { ok: boolean; data?: { running: boolean } };
        if (mounted && body.ok && body.data) {
          setServerRunning(body.data.running);
        }
      } catch {
        // ignore transient errors
      }
    };

    void checkStatus();
    timer = setInterval(checkStatus, 1500);

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, []);

  const start = useCallback(async (runPhase: Phase) => {
    if (serverRunning) return;

    const abort = new AbortController();
    abortRef.current = abort;
    setState({ phase: "running", runPhase, steps: [], attached: null });
    setServerRunning(true);

    try {
      const headers = await authHeaders(true);

      const response = await fetch("/api/kane-player/run", {
        method: "POST",
        headers,
        body: JSON.stringify({ phase: runPhase }),
        signal: abort.signal,
      });

      if (!response.ok || !response.body) {
        const text = await response.text().catch(() => "Unknown error");
        setState({ phase: "error", runPhase, message: text, steps: [], attached: null });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const dataLine = part.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;

          try {
            const event = JSON.parse(dataLine.slice(6)) as Record<string, unknown>;

            if (event.type === "info") {
              const attached = Boolean(event.attached);
              setState((prev) =>
                prev.phase === "running" ? { ...prev, attached } : prev,
              );
            } else if (event.type === "step") {
              setState((prev) => {
                const prevSteps =
                  prev.phase === "running" || prev.phase === "error" || prev.phase === "done"
                    ? [...(prev as { steps: KaneStep[] }).steps]
                    : [];
                const attached = "attached" in prev ? prev.attached : null;
                return {
                  phase: "running",
                  runPhase,
                  attached,
                  steps: [
                    ...prevSteps,
                    {
                      step: event.step as number,
                      status: event.status as string,
                      remark: event.remark as string,
                    },
                  ],
                };
              });
              onStep?.();
            } else if (event.type === "done") {
              setState((prev) => ({
                phase: "done",
                runPhase,
                status: event.status as string,
                summary: (event.summary ?? event.oneliner ?? "Run complete") as string,
                duration: (event.duration ?? 0) as number,
                steps: prev.phase === "running" ? prev.steps : [],
                attached: "attached" in prev ? prev.attached : null,
              }));
              setServerRunning(false);
              onStep?.();
            } else if (event.type === "error") {
              setState((prev) => ({
                phase: "error",
                runPhase,
                message: event.message as string,
                steps: prev.phase === "running" ? prev.steps : [],
                attached: "attached" in prev ? prev.attached : null,
              }));
              setServerRunning(false);
            }
          } catch {
            // malformed SSE line — skip
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        // The connection was cut (e.g. page navigation). Kane may still be
        // running server-side; the status poll will keep Stop available.
        return;
      }
      setState((prev) => ({
        phase: "error",
        runPhase: prev.phase === "running" ? prev.runPhase : "activity",
        message: (err as Error).message ?? "Unknown error",
        steps: prev.phase === "running" ? prev.steps : [],
        attached: "attached" in prev ? prev.attached : null,
      }));
    }
  }, [serverRunning, onStep]);

  // Reload-proof stop: tells the SERVER to kill the process. Works even if this
  // component never started the run (e.g. after a navigation remount).
  const stop = useCallback(async () => {
    setStopping(true);
    try {
      abortRef.current?.abort();
      const headers = await authHeaders(true);
      await fetch("/api/kane-player/stop", { method: "POST", headers });
    } catch {
      // ignore
    } finally {
      setServerRunning(false);
      setStopping(false);
      setState((prev) =>
        prev.phase === "running"
          ? { phase: "idle" }
          : prev,
      );
    }
  }, []);

  const reset = useCallback(() => {
    setState({ phase: "idle" });
  }, []);

  const steps =
    state.phase === "running" || state.phase === "done" || state.phase === "error"
      ? state.steps
      : [];

  const runPhaseLabel =
    state.phase !== "idle" ? (state.runPhase === "mission" ? "Mission" : "Activity") : "";

  // Show Stop whenever the SERVER reports a run in progress — independent of
  // this component's own SSE state, so it persists across reloads.
  const showStop = serverRunning;

  return (
    <div className={styles.kanePlayer}>
      <div className={styles.header}>
        <span className={styles.badge}>🤖 Kane Player</span>
        {showStop && (
          <button
            className={styles.stopButton}
            onClick={() => void stop()}
            type="button"
            disabled={stopping}
          >
            {stopping ? "Stopping…" : "■ Stop"}
          </button>
        )}
        {!showStop && (state.phase === "done" || state.phase === "error") && (
          <button className={styles.resetButton} onClick={reset} type="button">
            ↺ Reset
          </button>
        )}
      </div>

      {!showStop && state.phase === "idle" && (
        <>
          <p className={styles.description}>
            Launches a visible Chrome window that plays through the game automatically.
          </p>
          <div className={styles.phaseButtons}>
            <button
              className={styles.startButton}
              onClick={() => void start("activity")}
              type="button"
            >
              ▶ Play Activity
            </button>
            <button
              className={`${styles.startButton} ${styles.missionButton}`}
              onClick={() => void start("mission")}
              type="button"
            >
              ▶ Play Mission
            </button>
          </div>
        </>
      )}

      {showStop && steps.length === 0 && (
        <p className={styles.statusLine}>
          Kane Player is running{runPhaseLabel ? ` (${runPhaseLabel})` : ""}…
        </p>
      )}

      {showStop && steps.length > 0 && (
        <p className={styles.statusLine}>Playing {runPhaseLabel}…</p>
      )}

      {state.phase !== "idle" && "attached" in state && state.attached !== null && (
        <p className={styles.attachLine}>
          {state.attached
            ? "🔗 Driving your Chrome tab"
            : "🪟 Launched a new browser (no debug Chrome found on :9222)"}
        </p>
      )}

      {steps.length > 0 && (
        <ol className={styles.stepList} aria-label="Kane Player steps">
          {steps.map((s) => (
            <li
              className={`${styles.step} ${s.status === "failed" ? styles.stepFailed : styles.stepPassed}`}
              key={s.step}
            >
              <span className={styles.stepIcon}>{s.status === "failed" ? "✗" : "✓"}</span>
              <span className={styles.stepRemark}>{s.remark}</span>
            </li>
          ))}
          {showStop && (
            <li className={`${styles.step} ${styles.stepPending}`} aria-live="polite">
              <span className={styles.stepIcon}>…</span>
              <span className={styles.stepRemark}>Working…</span>
            </li>
          )}
        </ol>
      )}

      {!showStop && state.phase === "done" && (
        <div
          className={`${styles.result} ${state.status === "passed" ? styles.resultPassed : styles.resultFailed}`}
          role="status"
        >
          <strong>{state.status === "passed" ? `✅ ${runPhaseLabel} complete` : `❌ ${runPhaseLabel} finished with issues`}</strong>
          <p>{state.summary}</p>
          {state.duration > 0 && (
            <span className={styles.duration}>{Math.round(state.duration)}s</span>
          )}
        </div>
      )}

      {!showStop && state.phase === "error" && (
        <div className={styles.errorBox} role="alert">
          <strong>⚠ Kane Player error</strong>
          <p>{state.message}</p>
        </div>
      )}
    </div>
  );
}
