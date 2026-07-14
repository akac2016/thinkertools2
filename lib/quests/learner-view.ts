/**
 * Pure helper module that maps endpoint payloads to render models for the
 * learner-facing ThinkerTools Missions component.
 *
 * No live DB access — pure functions over endpoint shapes so they can be
 * property-tested.
 *
 * Requirements: 1.2, 1.3, 1.8, 2.3, 4.4, 5.2, 5.3, 5.4
 */

// ---------------------------------------------------------------------------
// Types — endpoint response shapes (what the endpoints return)
// ---------------------------------------------------------------------------

/** Shape of a single training as returned by GET /trainings */
export type TrainingEntry = {
  id: string | null | undefined;
  slug: string | null | undefined;
  title: string | null | undefined;
  maxLevel?: number;
};

/** Shape of a single activity group as returned by GET /trainings/[slug]/groups */
export type ActivityGroupEntry = {
  id: string;
  slug: string;
  title: string;
  description: string;
  trainingId: string;
  displayOrder: number;
};

/** Shape of a single mission as returned by GET /missions */
export type MissionEntry = {
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

/** Shape of progress as returned by endpoints */
export type ProgressEntry = {
  currentLevel: number;
  currentLevelXp: number;
  totalXp: number;
  xpRequiredForNextLevel: number;
  xpRemainingForNextLevel: number;
};

// ---------------------------------------------------------------------------
// Types — render models (what the component consumes)
// ---------------------------------------------------------------------------

/** A valid training ready for rendering (Req 1.2, 1.3) */
export type TrainingRenderEntry = {
  id: string;
  slug: string;
  title: string;
  maxLevel: number;
};

/** An activity group ready for rendering (Req 2.3) */
export type ActivityGroupRenderEntry = {
  slug: string;
  title: string;
  description: string;
};

/** A mission ready for rendering (Req 4.4) */
export type MissionRenderEntry = {
  slug: string;
  title: string;
  isActive: boolean;
};

/** Progress keyed by training id (Req 5.2, 5.3, 5.4) */
export type ProgressByTrainingId = {
  trainingId: string;
  level: number;
  xp: number;
  totalXp: number;
  xpRequiredForNextLevel: number;
  xpRemainingForNextLevel: number;
};

// ---------------------------------------------------------------------------
// Types — typed fallback constants (the shapes the component currently uses)
// ---------------------------------------------------------------------------

export type FallbackSkillActivity = {
  id: string;
  level: number;
  name: string;
  xp: number;
  status: "Unlocked" | "Locked";
  requirements: string[];
};

export type FallbackSkill = {
  id: string;
  name: string;
  level: number;
  xp: number;
  activities: FallbackSkillActivity[];
};

export type FallbackMission = {
  id: string;
  title: string;
  status: "Available" | "Locked";
  requirements: string[];
  revealedFacts: string[];
};

// ---------------------------------------------------------------------------
// 1. Map trainings endpoint response to render entries
//    Filters out rows missing a non-empty id/slug/title (Req 1.8)
//    One entry per valid training (Req 1.2, 1.3)
// ---------------------------------------------------------------------------

/**
 * Returns true if a training entry has all required non-empty fields.
 */
export function isValidTrainingEntry(entry: TrainingEntry): boolean {
  return (
    typeof entry.id === "string" && entry.id.trim().length > 0 &&
    typeof entry.slug === "string" && entry.slug.trim().length > 0 &&
    typeof entry.title === "string" && entry.title.trim().length > 0
  );
}

/**
 * Maps a trainings endpoint response to render entries, skipping rows
 * missing a non-empty id/slug/title.
 */
export function mapTrainingsToRenderEntries(
  trainings: TrainingEntry[],
): TrainingRenderEntry[] {
  return trainings
    .filter(isValidTrainingEntry)
    .map((t) => ({
      id: t.id as string,
      slug: t.slug as string,
      title: t.title as string,
      maxLevel: typeof t.maxLevel === "number" ? t.maxLevel : 20,
    }));
}

// ---------------------------------------------------------------------------
// 2. Map activity-groups endpoint response to render entries
//    One entry per group in received order (Req 2.3)
// ---------------------------------------------------------------------------

/**
 * Maps activity groups to render entries, preserving the received order.
 * Each entry uses the group's slug, title, and description.
 */
export function mapActivityGroupsToRenderEntries(
  groups: ActivityGroupEntry[],
): ActivityGroupRenderEntry[] {
  return groups.map((g) => ({
    slug: g.slug,
    title: g.title,
    description: g.description,
  }));
}

// ---------------------------------------------------------------------------
// 3. Map missions endpoint response to render entries
//    One entry per mission (slug/title/active state) (Req 4.4)
// ---------------------------------------------------------------------------

/**
 * Maps missions to render entries using each mission's slug, title, and
 * active state.
 */
export function mapMissionsToRenderEntries(
  missions: MissionEntry[],
): MissionRenderEntry[] {
  return missions.map((m) => ({
    slug: m.slug,
    title: m.title,
    isActive: m.isActive,
  }));
}

// ---------------------------------------------------------------------------
// 4. Resolve training by slug and key progress by id
//    Resolve `philosophical-reasoning` by slug, then key progress/level/XP
//    by its id (Req 5.2, 5.3, 5.4)
// ---------------------------------------------------------------------------

const PHILOSOPHICAL_REASONING_SLUG = "philosophical-reasoning" as const;

/**
 * Resolves the `philosophical-reasoning` training from a list of trainings
 * by matching on slug. Returns the matched training or null if not found.
 */
export function resolvePhilosophicalReasoningTraining(
  trainings: TrainingRenderEntry[],
): TrainingRenderEntry | null {
  return trainings.find((t) => t.slug === PHILOSOPHICAL_REASONING_SLUG) ?? null;
}

/**
 * Keys progress by the training's id (not slug). Given a training id and
 * a progress entry, returns a ProgressByTrainingId keyed by that id.
 *
 * Req 5.2: key request by training id
 * Req 5.3: display level and XP associated with the matching training id
 * Req 5.4: match by id returned from endpoint, not hardcoded slug
 */
export function keyProgressByTrainingId(
  trainingId: string,
  progress: ProgressEntry,
): ProgressByTrainingId {
  return {
    trainingId,
    level: progress.currentLevel,
    xp: progress.currentLevelXp,
    totalXp: progress.totalXp,
    xpRequiredForNextLevel: progress.xpRequiredForNextLevel,
    xpRemainingForNextLevel: progress.xpRemainingForNextLevel,
  };
}

/**
 * Resolves the philosophical-reasoning training from the trainings list,
 * then keys the given progress by that training's id.
 *
 * Returns null if the training cannot be found (Req 5.5 — display error,
 * no level/XP).
 */
export function resolveProgressForPhilosophicalReasoning(
  trainings: TrainingRenderEntry[],
  progress: ProgressEntry,
): ProgressByTrainingId | null {
  const training = resolvePhilosophicalReasoningTraining(trainings);
  if (!training) {
    return null;
  }
  return keyProgressByTrainingId(training.id, progress);
}

// ---------------------------------------------------------------------------
// 5. Fallback-merge helper for typed constants
//    Merges DB data with typed constants on failure so the UI never regresses
//    during the staged cutover (Req 6.1, 6.6)
// ---------------------------------------------------------------------------

export type FallbackMergeResult<T> = {
  source: "data" | "fallback";
  entries: T[];
};

/**
 * Returns data-driven entries if available (non-null, non-empty array),
 * otherwise falls back to the typed constants.
 *
 * This ensures the UI keeps rendering during the staged cutover even if
 * an endpoint fails or returns empty.
 */
export function fallbackMerge<T>(
  dataEntries: T[] | null | undefined,
  fallbackEntries: T[],
): FallbackMergeResult<T> {
  if (dataEntries != null && dataEntries.length > 0) {
    return { source: "data", entries: dataEntries };
  }
  return { source: "fallback", entries: fallbackEntries };
}

/**
 * Merges trainings from the endpoint with the fallback skills constant.
 * If the endpoint returned valid trainings, maps them to render entries.
 * Otherwise, maps the fallback skills to a compatible shape.
 */
export function mergeTrainingsWithFallback(
  endpointTrainings: TrainingEntry[] | null | undefined,
  fallbackSkills: FallbackSkill[],
): FallbackMergeResult<TrainingRenderEntry> {
  const dataEntries = endpointTrainings
    ? mapTrainingsToRenderEntries(endpointTrainings)
    : null;

  if (dataEntries && dataEntries.length > 0) {
    return { source: "data", entries: dataEntries };
  }

  // Map fallback skills to the TrainingRenderEntry shape
  const fallbackEntries: TrainingRenderEntry[] = fallbackSkills.map((skill) => ({
    id: skill.id,
    slug: skill.id,
    title: skill.name,
    maxLevel: 20,
  }));

  return { source: "fallback", entries: fallbackEntries };
}

/**
 * Merges activity groups from the endpoint with the fallback skill activities.
 * If the endpoint returned groups, maps them to render entries.
 * Otherwise, maps the fallback activities to a compatible shape.
 */
export function mergeActivityGroupsWithFallback(
  endpointGroups: ActivityGroupEntry[] | null | undefined,
  fallbackActivities: FallbackSkillActivity[],
): FallbackMergeResult<ActivityGroupRenderEntry> {
  const dataEntries = endpointGroups
    ? mapActivityGroupsToRenderEntries(endpointGroups)
    : null;

  if (dataEntries && dataEntries.length > 0) {
    return { source: "data", entries: dataEntries };
  }

  // Map fallback activities to the ActivityGroupRenderEntry shape
  const fallbackEntries: ActivityGroupRenderEntry[] = fallbackActivities.map((activity) => ({
    slug: activity.id,
    title: activity.name,
    description: "",
  }));

  return { source: "fallback", entries: fallbackEntries };
}

/**
 * Merges missions from the endpoint with the fallback missions constant.
 * If the endpoint returned missions, maps them to render entries.
 * Otherwise, maps the fallback missions to a compatible shape.
 */
export function mergeMissionsWithFallback(
  endpointMissions: MissionEntry[] | null | undefined,
  fallbackMissions: FallbackMission[],
): FallbackMergeResult<MissionRenderEntry> {
  const dataEntries = endpointMissions
    ? mapMissionsToRenderEntries(endpointMissions)
    : null;

  if (dataEntries && dataEntries.length > 0) {
    return { source: "data", entries: dataEntries };
  }

  // Map fallback missions to the MissionRenderEntry shape
  const fallbackEntries: MissionRenderEntry[] = fallbackMissions.map((mission) => ({
    slug: mission.id,
    title: mission.title,
    isActive: mission.status === "Available",
  }));

  return { source: "fallback", entries: fallbackEntries };
}
