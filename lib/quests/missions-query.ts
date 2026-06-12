/**
 * Pure helper for filtering and ordering active missions rows.
 * Extracted so it can be property-tested without a live DB.
 */

export type RawMissionRow = {
  id: string;
  slug: string;
  title: string;
  xp_reward: number;
  publication_status: 'pending' | 'live' | 'archived';
};

export type MissionListEntry = {
  id: string;
  slug: string;
  title: string;
  xpReward: number;
  isActive: boolean;
  isCompleted: boolean;
  completedAt: string | null;
  awardedXp: number;
  replayCount: number;
  canReplay: boolean;
};

export type RawCompletionRow = {
  mission_id: string;
  awarded_xp: number;
  completion_metadata: Record<string, unknown> | null;
  completed_at: string | null;
};

/**
 * Filters to active missions only and orders by slug ascending.
 */
export function filterAndOrderActiveMissions(rows: RawMissionRow[]): RawMissionRow[] {
  return rows
    .filter((row) => row.publication_status === 'live')
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

/**
 * Merges completion data into mission rows to produce the final list entries.
 */
export function mergeMissionsWithCompletions(
  missions: RawMissionRow[],
  completions: RawCompletionRow[],
): MissionListEntry[] {
  const completionsByMissionId = new Map<string, RawCompletionRow>();
  for (const c of completions) {
    completionsByMissionId.set(c.mission_id, c);
  }

  return missions.map((mission) => {
    const completion = completionsByMissionId.get(mission.id);
    return {
      id: mission.id,
      slug: mission.slug,
      title: mission.title,
      xpReward: mission.xp_reward,
      isActive: mission.publication_status === 'live',
      isCompleted: Boolean(completion),
      completedAt: completion?.completed_at ?? null,
      awardedXp: completion?.awarded_xp ?? 0,
      replayCount: getReplayCount(completion?.completion_metadata),
      canReplay: true,
    };
  });
}

function getReplayCount(metadata: Record<string, unknown> | null | undefined): number {
  const replayCount = metadata?.replay_count;
  return typeof replayCount === "number" && Number.isFinite(replayCount)
    ? Math.max(0, replayCount)
    : 0;
}
