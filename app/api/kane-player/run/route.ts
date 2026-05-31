import "server-only";

import { spawn } from "child_process";

import { requireActorIdFromRequest } from "@/lib/auth/actor";
import { jsonError } from "@/lib/http";
import { registerKaneProcess } from "@/lib/kane/process-registry";

// Two-phase Kane Player objectives.
//
// Phase 1 — Activity: open an unlocked contradiction-spotting drill and answer it.
// Phase 2 — Mission: start the available mission and complete every stage.
//
// Splitting into two focused runs is more reliable than one giant objective.

const KANE_ACTIVITY_OBJECTIVE = [
  "Go to http://localhost:3000/thinkertools-missions and wait for the page to load. Stay on this site for the entire task.",
  "On the left side panel, find the Training section.",
  "Click on 'Philosophical Thinking' to expand it and see its activities.",
  "Click the first activity that is labeled 'Unlocked' to open it.",
  "Wait for the activity question to appear in the chat area.",
  "Read the question and the labeled claim options (A, B, C, D) carefully.",
  "Click the two claim buttons that are in the strongest logical contradiction with each other.",
  "Click the Submit button to submit the answer.",
  "If feedback says the answer is wrong, click a different pair of claims and submit again.",
  "Assert that a result or feedback message appears confirming the activity was answered.",
].join(" ");

const KANE_MISSION_OBJECTIVE = [
  "Go to http://localhost:3000/thinkertools-missions and wait for the page to load. Stay on this site for the entire task.",
  "In the Missions panel on the right, click on 'The Wrong Recruit' mission.",
  "Click the 'Start Mission' button.",
  "Read the briefing text and click the next action button to advance.",
  "When shown character statements, read them and click the next action button.",
  "When asked to identify the contradiction, select the two claim buttons that contradict each other most strongly, then submit.",
  "If the contradiction answer is wrong, try a different pair and submit again.",
  "When shown resolution options, select the option that best resolves the contradiction while preserving the rule, then submit.",
  "If the resolution answer is wrong, try a different option.",
  "Click the Complete Mission button when it appears.",
  "Assert that the mission panel shows 'Completed' or a completion message.",
].join(" ");

const DEFAULT_CDP_PORT = process.env.KANE_CHROME_PORT?.trim() || "9222";

// Resolves the CDP endpoint for attaching to an existing Chrome.
// Returns null when no debug Chrome is reachable (Kane then launches its own).
async function resolveCdpEndpoint(): Promise<string | null> {
  const explicit = process.env.KANE_CDP_ENDPOINT?.trim();
  if (explicit) {
    return explicit;
  }

  // Auto-detect: probe the standard debug port. If a Chrome is listening with
  // remote debugging, /json/version responds with its metadata.
  const candidate = `http://localhost:${DEFAULT_CDP_PORT}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const response = await fetch(`${candidate}/json/version`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (response.ok) {
      return candidate;
    }
  } catch {
    // Nothing listening — fall through.
  }

  return null;
}

export async function POST(request: Request) {
  const actor = await requireActorIdFromRequest(request);
  if (!actor.ok) {
    return actor.response;
  }

  // Optional phase param: "activity" | "mission" (defaults to "activity")
  let phase: "activity" | "mission" = "activity";
  try {
    const body = await request.json() as { phase?: string };
    if (body.phase === "mission") phase = "mission";
  } catch {
    // no body or non-JSON — use default
  }

  const objective = phase === "mission" ? KANE_MISSION_OBJECTIVE : KANE_ACTIVITY_OBJECTIVE;

  // Check kane-cli is available
  const whichResult = await new Promise<boolean>((resolve) => {
    const which = spawn("which", ["kane-cli"]);
    which.on("close", (code) => resolve(code === 0));
  });

  if (!whichResult) {
    return jsonError("kane-cli is not installed on this server", {
      status: 503,
      code: "KANE_CLI_NOT_FOUND",
    });
  }

  // Resolve the CDP endpoint so Kane attaches to the existing (logged-in)
  // Chrome instead of launching a fresh window.
  //   1. Honor KANE_CDP_ENDPOINT if explicitly set.
  //   2. Otherwise auto-detect a debug Chrome on localhost:9222.
  const cdpEndpoint = await resolveCdpEndpoint();

  const encoder = new TextEncoder();

  function sseEvent(data: object): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  }

  // Tracks whether the stream controller is still open.
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const safeEnqueue = (data: object) => {
        if (closed) return;
        try {
          controller.enqueue(sseEvent(data));
        } catch {
          // Controller already closed/errored — ignore.
        }
      };

      const safeClose = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // Already closed — ignore.
        }
      };

      const args = [
        "run",
        objective,
        "--agent",
        // No --headless: visible Chrome window makes for a better demo
        "--timeout",
        "180",
        "--max-steps",
        "40",
        "--local-context",
        ".testmuai/context.md",
      ];

      if (cdpEndpoint) {
        // Attach to the user's already-running Chrome — drives the current tab,
        // no new window, no re-auth.
        args.push("--cdp-endpoint", cdpEndpoint);
      }

      // Tell the client which mode we're in so the UI can hint at it.
      safeEnqueue({
        type: "info",
        attached: Boolean(cdpEndpoint),
      });

      const kane = spawn("kane-cli", args, {
        cwd: process.cwd(),
      });
      registerKaneProcess(kane, phase);

      let buffer = "";

      kane.stdout.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const event = JSON.parse(trimmed) as Record<string, unknown>;

            if (event.type === "run_end") {
              safeEnqueue({
                type: "done",
                status: event.status,
                summary: event.summary,
                oneliner: event.one_liner,
                duration: event.duration,
              });
            } else if (typeof event.step === "number") {
              // Progress event
              safeEnqueue({
                type: "step",
                step: event.step,
                status: event.status,
                remark: event.remark,
              });
            }
            // Ignore other typed events (bifurcation, child_agent_*, etc.)
          } catch {
            // Non-JSON line — skip
          }
        }
      });

      kane.stderr.on("data", () => {
        // stderr is the TUI — ignore it
      });

      kane.on("close", (code) => {
        if (buffer.trim()) {
          try {
            const event = JSON.parse(buffer.trim()) as Record<string, unknown>;
            if (event.type === "run_end") {
              safeEnqueue({
                type: "done",
                status: event.status,
                summary: event.summary,
                oneliner: event.one_liner,
                duration: event.duration,
              });
            }
          } catch {
            // ignore
          }
        }

        // code === null means the process was killed by a signal (Stop button).
        if (code !== 0 && code !== null) {
          safeEnqueue({
            type: "error",
            message:
              code === 1
                ? "Kane Player did not complete the mission."
                : code === 2
                  ? "Kane CLI auth or setup error. Run kane-cli whoami to check."
                  : code === 3
                    ? "Kane Player timed out. The mission may need more time."
                    : `Kane CLI exited with code ${code}.`,
            exitCode: code,
          });
        }

        safeEnqueue({ type: "close" });
        safeClose();
      });

      kane.on("error", (err) => {
        safeEnqueue({ type: "error", message: `Failed to start kane-cli: ${err.message}` });
        safeEnqueue({ type: "close" });
        safeClose();
      });
    },

    // Client disconnect (page navigation/reload or Stop). Do NOT kill the
    // process here — navigation happens routinely while Kane drives the tab.
    // Stopping is handled explicitly via the /stop endpoint (OS-level kill).
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
