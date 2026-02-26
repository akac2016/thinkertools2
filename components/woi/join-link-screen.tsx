"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { getViewerJoinErrorMessage, joinGameByLink } from "@/components/woi/client";
import { InlineMessage, WoiSection, WoiShell } from "@/components/woi/shell";

export function WoiJoinLinkScreen({ gameId }: { gameId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tokenFromQuery = useMemo(
    () => searchParams.get("token")?.trim() ?? "",
    [searchParams],
  );
  const [token, setToken] = useState(tokenFromQuery);
  const [error, setError] = useState<string | null>(null);
  const [joiningAs, setJoiningAs] = useState<"player" | "viewer" | null>(null);

  const runJoin = async (joinAs: "player" | "viewer") => {
    setError(null);

    const normalizedToken = token.trim();
    if (!normalizedToken) {
      setError("Join token is required.");
      return;
    }

    setJoiningAs(joinAs);
    try {
      await joinGameByLink({
        gameId,
        token: normalizedToken,
        joinAs,
      });
      router.push(`/woi/games/${gameId}`);
    } catch (joinError) {
      if (joinAs === "viewer") {
        setError(getViewerJoinErrorMessage(joinError, "Failed to join game"));
      } else {
        setError(joinError instanceof Error ? joinError.message : "Failed to join game");
      }
    } finally {
      setJoiningAs((current) => (current === joinAs ? null : current));
    }
  };

  return (
    <WoiShell title="Join Game" subtitle="Use your invite link to join as a player or viewer.">
      <WoiSection title="Join by Link">
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            Game ID: <span className="font-mono text-xs text-slate-900">{gameId}</span>
          </p>
          <label className="block text-sm text-slate-700">
            <span className="mb-1 block">Join token</span>
            <input
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Paste token from your invite link"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runJoin("player")}
              disabled={joiningAs !== null}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {joiningAs === "player" ? "Joining..." : "Join as player"}
            </button>
            <button
              type="button"
              onClick={() => void runJoin("viewer")}
              disabled={joiningAs !== null}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {joiningAs === "viewer" ? "Joining..." : "Join as viewer"}
            </button>
            <Link
              href="/woi"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Back to lobby
            </Link>
          </div>
          {error ? <InlineMessage kind="error">{error}</InlineMessage> : null}
        </div>
      </WoiSection>
    </WoiShell>
  );
}
