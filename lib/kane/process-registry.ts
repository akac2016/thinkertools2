import "server-only";

import { spawn } from "child_process";
import type { ChildProcess } from "child_process";

// Tracks the currently-running Kane Player process so it can be stopped from a
// separate request — even after:
//   - the page that started it reloads (Kane navigates the attached tab), or
//   - the Next.js dev server restarts (which loses in-memory handles).
//
// Status and Stop are backed by OS-level process detection (pgrep/kill) so they
// remain correct regardless of in-memory state. The in-memory handle is kept
// only as a best-effort fast path.

type KaneRegistry = {
  process: ChildProcess | null;
  phase: "activity" | "mission" | null;
  startedAt: number | null;
};

const globalForKane = globalThis as unknown as {
  __kanePlayerRegistry?: KaneRegistry;
};

function getRegistry(): KaneRegistry {
  if (!globalForKane.__kanePlayerRegistry) {
    globalForKane.__kanePlayerRegistry = {
      process: null,
      phase: null,
      startedAt: null,
    };
  }
  return globalForKane.__kanePlayerRegistry;
}

// Pattern that matches the Kane Player runs we spawn (`kane-cli run ...`).
const KANE_PROCESS_PATTERN = "kane-cli run";

// Returns the PIDs of any running kane-cli run processes via pgrep.
function findKanePids(): Promise<number[]> {
  return new Promise((resolve) => {
    // -f matches against the full command line. Pattern is a fixed string
    // (no user input) so there is no injection risk.
    const pgrep = spawn("pgrep", ["-f", KANE_PROCESS_PATTERN]);
    let out = "";

    pgrep.stdout.on("data", (chunk: Buffer) => {
      out += chunk.toString();
    });

    pgrep.on("close", () => {
      const ownPid = process.pid;
      const pids = out
        .split("\n")
        .map((line) => parseInt(line.trim(), 10))
        .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== ownPid);
      resolve(pids);
    });

    pgrep.on("error", () => resolve([]));
  });
}

export function registerKaneProcess(
  process: ChildProcess,
  phase: "activity" | "mission",
): void {
  const registry = getRegistry();
  registry.process = process;
  registry.phase = phase;
  registry.startedAt = Date.now();

  process.on("close", () => {
    const current = getRegistry();
    if (current.process === process) {
      current.process = null;
      current.phase = null;
      current.startedAt = null;
    }
  });
}

export async function getKaneStatus(): Promise<{
  running: boolean;
  phase: "activity" | "mission" | null;
  startedAt: number | null;
}> {
  const pids = await findKanePids();
  const running = pids.length > 0;
  const registry = getRegistry();

  return {
    running,
    // phase/startedAt are best-effort from the in-memory handle (may be null
    // after a server restart even while Kane is still running).
    phase: running ? registry.phase : null,
    startedAt: running ? registry.startedAt : null,
  };
}

// Kills any running Kane Player process. Returns the number of processes
// signalled. Uses OS-level kill so it works even after a server restart.
export async function stopKaneProcess(): Promise<number> {
  const pids = await findKanePids();

  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // already gone — ignore
    }
  }

  // SIGKILL fallback for anything that ignored SIGTERM.
  setTimeout(() => {
    void (async () => {
      const survivors = await findKanePids();
      for (const pid of survivors) {
        try {
          process.kill(pid, "SIGKILL");
        } catch {
          // ignore
        }
      }
    })();
  }, 1500);

  // Clear in-memory tracking too.
  const registry = getRegistry();
  registry.process = null;
  registry.phase = null;
  registry.startedAt = null;

  return pids.length;
}
