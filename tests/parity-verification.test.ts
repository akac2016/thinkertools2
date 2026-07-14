/**
 * Phase B — Parity Verification Gate (Task 12.1)
 *
 * Property 18: Data-path parity with the published content — the entity set
 * and displayed content from the data-driven read paths equals the expected
 * published set (zero missing, zero extra).
 *
 * This is a deterministic parity check (not a generative property test).
 * It exercises the full data-driven pipeline:
 *   1. Query helpers (trainings-query, activity-groups-query, missions-query)
 *      that filter/order raw DB rows
 *   2. Learner-view helpers that map endpoint payloads to render models
 *
 * The check compares the output against the known-good published entity set
 * derived from the database seed migrations.
 *
 * Validates: Requirements 6.2, 6.6
 *
 * Feature: thinkertools-missions-data-driven-consumer, Property 18: Data-path
 * parity with the published content
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  mapTrainingsToRenderEntries,
  mapActivityGroupsToRenderEntries,
  mapMissionsToRenderEntries,
  fallbackMerge,
  type TrainingEntry,
  type ActivityGroupEntry,
  type MissionEntry,
} from "../lib/quests/learner-view.ts";

import {
  filterCapOrderTrainings,
  type RawTrainingRow,
} from "../lib/quests/trainings-query.ts";

import {
  filterOrderActivityGroups,
  type RawActivityGroupRow,
} from "../lib/quests/activity-groups-query.ts";

import {
  filterAndOrderActiveMissions,
  mergeMissionsWithCompletions,
  type RawMissionRow,
  type RawCompletionRow,
} from "../lib/quests/missions-query.ts";

// ---------------------------------------------------------------------------
// Known-good published entity set (from DB seed migrations)
// ---------------------------------------------------------------------------

// The philosophical-reasoning training (from 20260412163000_quests_domain_foundation.sql)
const PUBLISHED_TRAINING_ID = "training-uuid-philosophical-reasoning";
const PUBLISHED_TRAINING_SLUG = "philosophical-reasoning";
const PUBLISHED_TRAINING_TITLE = "Philosophical Reasoning";

// The 5 activity groups (from 20260514030000_training_activity_groups.sql)
const PUBLISHED_ACTIVITY_GROUPS = [
  {
    slug: "philo-contradiction-spotting",
    title: "Contradiction Spotting",
    description: "Identify which two claims in a set are in strongest contradiction with each other.",
    displayOrder: 1,
  },
  {
    slug: "philo-rule-vs-exception",
    title: "Rule vs. Exception",
    description: "Identify when a stated rule and a stated exception cannot both hold.",
    displayOrder: 2,
  },
  {
    slug: "philo-principle-vs-action",
    title: "Principle vs. Action",
    description: "Identify when a stated principle and a described action are in direct conflict.",
    displayOrder: 3,
  },
  {
    slug: "philo-universal-vs-edge-case",
    title: "Universal vs. Edge Case",
    description: "Identify when a universal claim is undermined by a specific edge case.",
    displayOrder: 4,
  },
  {
    slug: "philo-belief-set-incompatible",
    title: "Incompatible Belief Set",
    description: "Identify the pair of beliefs within a set that cannot both be held consistently.",
    displayOrder: 5,
  },
] as const;

// The wrong-recruit mission (from 20260514020000_missions_body_column.sql)
const PUBLISHED_MISSION_SLUG = "wrong-recruit";
const PUBLISHED_MISSION_TITLE = "The Wrong Recruit";

// Invented placeholders that have NO database backing and must NOT appear
const INVENTED_ACTIVITY_SLUGS = ["explain-conflict", "missing-context"] as const;
const INVENTED_MISSION_SLUG = "missing-premise";

// ---------------------------------------------------------------------------
// Simulated raw DB rows (what the database returns before query helpers process)
// ---------------------------------------------------------------------------

const RAW_TRAINING_ROWS: RawTrainingRow[] = [
  {
    id: PUBLISHED_TRAINING_ID,
    slug: PUBLISHED_TRAINING_SLUG,
    title: PUBLISHED_TRAINING_TITLE,
    max_level: 20,
    publication_status: "live",
    created_at: "2025-04-12T16:30:00.000Z",
  },
];

const RAW_ACTIVITY_GROUP_ROWS: RawActivityGroupRow[] = PUBLISHED_ACTIVITY_GROUPS.map(
  (g, i) => ({
    id: `group-uuid-${i + 1}`,
    slug: g.slug,
    title: g.title,
    description: g.description,
    training_id: PUBLISHED_TRAINING_ID,
    display_order: g.displayOrder,
    publication_status: "live",
  }),
);

const RAW_MISSION_ROWS: RawMissionRow[] = [
  {
    id: "mission-uuid-wrong-recruit",
    slug: PUBLISHED_MISSION_SLUG,
    title: PUBLISHED_MISSION_TITLE,
    xp_reward: 60,
    publication_status: "live",
  },
];

// ---------------------------------------------------------------------------
// Simulated endpoint payloads (what the endpoints return after query helpers)
// ---------------------------------------------------------------------------

const DB_TRAININGS: TrainingEntry[] = [
  {
    id: PUBLISHED_TRAINING_ID,
    slug: PUBLISHED_TRAINING_SLUG,
    title: PUBLISHED_TRAINING_TITLE,
    maxLevel: 20,
  },
];

const DB_ACTIVITY_GROUPS: ActivityGroupEntry[] = PUBLISHED_ACTIVITY_GROUPS.map(
  (g, i) => ({
    id: `group-uuid-${i + 1}`,
    slug: g.slug,
    title: g.title,
    description: g.description,
    trainingId: PUBLISHED_TRAINING_ID,
    displayOrder: g.displayOrder,
  }),
);

const DB_MISSIONS: MissionEntry[] = [
  {
    id: "mission-uuid-wrong-recruit",
    slug: PUBLISHED_MISSION_SLUG,
    title: PUBLISHED_MISSION_TITLE,
    xpReward: 60,
    isActive: true,
    isCompleted: false,
    completedAt: null,
    awardedXp: 0,
    replayCount: 0,
    canReplay: true,
  },
];

// ---------------------------------------------------------------------------
// Query-layer parity tests (trainings-query, activity-groups-query, missions-query)
// ---------------------------------------------------------------------------

test("Property 18: Query-layer parity — trainings query produces the published training", () => {
  const result = filterCapOrderTrainings(RAW_TRAINING_ROWS);

  // Zero missing: the published training must appear
  assert.equal(result.length, 1, "Expected exactly 1 training from query layer");
  assert.equal(result[0].slug, PUBLISHED_TRAINING_SLUG);
  assert.equal(result[0].title, PUBLISHED_TRAINING_TITLE);
  assert.equal(result[0].id, PUBLISHED_TRAINING_ID);
  assert.equal(result[0].maxLevel, 20);
});

test("Property 18: Query-layer parity — trainings query excludes non-live rows", () => {
  const rowsWithInactive: RawTrainingRow[] = [
    ...RAW_TRAINING_ROWS,
    {
      id: "inactive-training-uuid",
      slug: "inactive-training",
      title: "Inactive Training",
      max_level: 10,
      publication_status: "archived",
      created_at: "2025-05-01T00:00:00.000Z",
    },
  ];

  const result = filterCapOrderTrainings(rowsWithInactive);
  assert.equal(result.length, 1, "Inactive training must not appear");
  assert.equal(result[0].slug, PUBLISHED_TRAINING_SLUG);
});

test("Property 18: Query-layer parity — activity groups query produces all 5 published groups", () => {
  const result = filterOrderActivityGroups(RAW_ACTIVITY_GROUP_ROWS, PUBLISHED_TRAINING_ID);

  assert.equal(result.length, 5, "Expected exactly 5 activity groups from query layer");

  for (const expected of PUBLISHED_ACTIVITY_GROUPS) {
    const found = result.find((g) => g.slug === expected.slug);
    assert.ok(found, `Published group '${expected.slug}' missing from query result`);
    assert.equal(found.title, expected.title, `Group '${expected.slug}' title mismatch`);
    assert.equal(found.description, expected.description, `Group '${expected.slug}' description mismatch`);
    assert.equal(found.displayOrder, expected.displayOrder, `Group '${expected.slug}' displayOrder mismatch`);
  }

  // Verify ordering: display_order ascending
  for (let i = 1; i < result.length; i++) {
    assert.ok(
      result[i].displayOrder >= result[i - 1].displayOrder,
      `Groups not in display_order order at index ${i}`,
    );
  }
});

test("Property 18: Query-layer parity — activity groups query excludes other trainings", () => {
  const rowsWithForeignGroup: RawActivityGroupRow[] = [
    ...RAW_ACTIVITY_GROUP_ROWS,
    {
      id: "foreign-group-uuid",
      slug: "foreign-group",
      title: "Foreign Group",
      description: "Belongs to another training",
      training_id: "other-training-uuid",
      display_order: 1,
      publication_status: "live",
    },
  ];

  const result = filterOrderActivityGroups(rowsWithForeignGroup, PUBLISHED_TRAINING_ID);
  assert.equal(result.length, 5, "Foreign training's group must not appear");
  assert.ok(
    !result.find((g) => g.slug === "foreign-group"),
    "Foreign group must be excluded",
  );
});

test("Property 18: Query-layer parity — missions query produces the published mission", () => {
  const result = filterAndOrderActiveMissions(RAW_MISSION_ROWS);

  assert.equal(result.length, 1, "Expected exactly 1 active mission from query layer");
  assert.equal(result[0].slug, PUBLISHED_MISSION_SLUG);
  assert.equal(result[0].title, PUBLISHED_MISSION_TITLE);
});

test("Property 18: Query-layer parity — missions query excludes non-live missions", () => {
  const rowsWithInactive: RawMissionRow[] = [
    ...RAW_MISSION_ROWS,
    {
      id: "inactive-mission-uuid",
      slug: "inactive-mission",
      title: "Inactive Mission",
      xp_reward: 30,
      publication_status: "archived",
    },
  ];

  const result = filterAndOrderActiveMissions(rowsWithInactive);
  assert.equal(result.length, 1, "Inactive mission must not appear");
  assert.equal(result[0].slug, PUBLISHED_MISSION_SLUG);
});

test("Property 18: Query-layer parity — missions merge with completions", () => {
  const activeMissions = filterAndOrderActiveMissions(RAW_MISSION_ROWS);
  const completions: RawCompletionRow[] = [];

  const merged = mergeMissionsWithCompletions(activeMissions, completions);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].slug, PUBLISHED_MISSION_SLUG);
  assert.equal(merged[0].title, PUBLISHED_MISSION_TITLE);
  assert.equal(merged[0].isActive, true);
  assert.equal(merged[0].isCompleted, false);
});

// ---------------------------------------------------------------------------
// Render-layer parity tests (learner-view.ts helpers)
// ---------------------------------------------------------------------------

test("Property 18: Render-layer parity — trainings (zero missing, zero extra)", () => {
  const rendered = mapTrainingsToRenderEntries(DB_TRAININGS);

  // Zero missing: the published training must appear
  const publishedTraining = rendered.find((t) => t.slug === PUBLISHED_TRAINING_SLUG);
  assert.ok(
    publishedTraining,
    `Published training '${PUBLISHED_TRAINING_SLUG}' is missing from data-driven set`,
  );
  assert.equal(
    publishedTraining.title,
    PUBLISHED_TRAINING_TITLE,
    `Training title mismatch: expected '${PUBLISHED_TRAINING_TITLE}', got '${publishedTraining.title}'`,
  );

  // Zero extra: every rendered training must be a genuinely published DB entity
  for (const t of rendered) {
    assert.ok(
      t.id && t.slug && t.title,
      `Rendered training has empty fields: ${JSON.stringify(t)}`,
    );
  }

  // The old wrong slug must NOT appear
  const wrongSlug = rendered.find((t) => t.slug === "philosophical-thinking");
  assert.equal(
    wrongSlug,
    undefined,
    "The incorrect slug 'philosophical-thinking' must not appear in the data-driven set",
  );

  // Exactly 1 training in the published set
  assert.equal(rendered.length, 1, "Expected exactly 1 published training");
});

test("Property 18: Render-layer parity — activity groups (zero missing, zero extra)", () => {
  const rendered = mapActivityGroupsToRenderEntries(DB_ACTIVITY_GROUPS);

  // Zero missing: all 5 published groups must appear with correct content
  for (const expected of PUBLISHED_ACTIVITY_GROUPS) {
    const found = rendered.find((g) => g.slug === expected.slug);
    assert.ok(
      found,
      `Published activity group '${expected.slug}' is missing from data-driven set`,
    );
    assert.equal(
      found.title,
      expected.title,
      `Activity group '${expected.slug}' title mismatch: expected '${expected.title}', got '${found.title}'`,
    );
    assert.equal(
      found.description,
      expected.description,
      `Activity group '${expected.slug}' description mismatch`,
    );
  }

  // Zero extra: no invented "coming soon" activities appear
  for (const inventedSlug of INVENTED_ACTIVITY_SLUGS) {
    const found = rendered.find((g) => g.slug === inventedSlug);
    assert.equal(
      found,
      undefined,
      `Invented placeholder '${inventedSlug}' must NOT appear in the data-driven set (no DB backing)`,
    );
  }

  // Exactly 5 groups in the published set
  assert.equal(rendered.length, 5, "Expected exactly 5 published activity groups");
});

test("Property 18: Render-layer parity — missions (zero missing, zero extra)", () => {
  const rendered = mapMissionsToRenderEntries(DB_MISSIONS);

  // Zero missing: the wrong-recruit mission must appear
  const publishedMission = rendered.find((m) => m.slug === PUBLISHED_MISSION_SLUG);
  assert.ok(
    publishedMission,
    `Published mission '${PUBLISHED_MISSION_SLUG}' is missing from data-driven set`,
  );
  assert.equal(
    publishedMission.title,
    PUBLISHED_MISSION_TITLE,
    `Mission title mismatch: expected '${PUBLISHED_MISSION_TITLE}', got '${publishedMission.title}'`,
  );
  assert.equal(
    publishedMission.isActive,
    true,
    "Published mission must be active",
  );

  // Zero extra: the invented 'missing-premise' mission must NOT appear
  const inventedMission = rendered.find((m) => m.slug === INVENTED_MISSION_SLUG);
  assert.equal(
    inventedMission,
    undefined,
    `Invented placeholder mission '${INVENTED_MISSION_SLUG}' must NOT appear in the data-driven set (no DB backing)`,
  );

  // Exactly 1 mission in the published set
  assert.equal(rendered.length, 1, "Expected exactly 1 published mission");
});

// ---------------------------------------------------------------------------
// Full end-to-end parity: query layer → render layer
// ---------------------------------------------------------------------------

test("Property 18: End-to-end parity — query + render pipeline produces exact published set", () => {
  // Step 1: Run query helpers on raw DB rows (simulating what the endpoints do)
  const queriedTrainings = filterCapOrderTrainings(RAW_TRAINING_ROWS);
  const queriedGroups = filterOrderActivityGroups(RAW_ACTIVITY_GROUP_ROWS, PUBLISHED_TRAINING_ID);
  const queriedMissions = filterAndOrderActiveMissions(RAW_MISSION_ROWS);
  const mergedMissions = mergeMissionsWithCompletions(queriedMissions, []);

  // Step 2: Map through render helpers (simulating what the component does)
  const renderedTrainings = mapTrainingsToRenderEntries(
    queriedTrainings.map((t) => ({ id: t.id, slug: t.slug, title: t.title, maxLevel: t.maxLevel })),
  );
  const renderedGroups = mapActivityGroupsToRenderEntries(
    queriedGroups.map((g) => ({
      id: g.id,
      slug: g.slug,
      title: g.title,
      description: g.description,
      trainingId: g.trainingId,
      displayOrder: g.displayOrder,
    })),
  );
  const renderedMissions = mapMissionsToRenderEntries(
    mergedMissions.map((m) => ({
      id: m.id,
      slug: m.slug,
      title: m.title,
      xpReward: m.xpReward,
      isActive: m.isActive,
      isCompleted: m.isCompleted,
      completedAt: m.completedAt,
      awardedXp: m.awardedXp,
      replayCount: m.replayCount,
      canReplay: m.canReplay,
    })),
  );

  // Step 3: Build expected and actual slug sets
  const expectedTrainingSlugs = new Set([PUBLISHED_TRAINING_SLUG]);
  const expectedGroupSlugs = new Set<string>(PUBLISHED_ACTIVITY_GROUPS.map((g) => g.slug));
  const expectedMissionSlugs = new Set([PUBLISHED_MISSION_SLUG]);

  const actualTrainingSlugs = new Set(renderedTrainings.map((t) => t.slug));
  const actualGroupSlugs = new Set(renderedGroups.map((g) => g.slug));
  const actualMissionSlugs = new Set(renderedMissions.map((m) => m.slug));

  // Zero missing: every expected entity is present
  for (const slug of expectedTrainingSlugs) {
    assert.ok(actualTrainingSlugs.has(slug), `Missing training: ${slug}`);
  }
  for (const slug of expectedGroupSlugs) {
    assert.ok(actualGroupSlugs.has(slug), `Missing activity group: ${slug}`);
  }
  for (const slug of expectedMissionSlugs) {
    assert.ok(actualMissionSlugs.has(slug), `Missing mission: ${slug}`);
  }

  // Zero extra: every actual entity is in the expected set
  for (const slug of actualTrainingSlugs) {
    assert.ok(expectedTrainingSlugs.has(slug), `Extra training not in published set: ${slug}`);
  }
  for (const slug of actualGroupSlugs) {
    assert.ok(expectedGroupSlugs.has(slug), `Extra activity group not in published set: ${slug}`);
  }
  for (const slug of actualMissionSlugs) {
    assert.ok(expectedMissionSlugs.has(slug), `Extra mission not in published set: ${slug}`);
  }

  // Verify displayed content matches for trainings
  const renderedPhilo = renderedTrainings.find((t) => t.slug === PUBLISHED_TRAINING_SLUG)!;
  assert.equal(renderedPhilo.title, PUBLISHED_TRAINING_TITLE);

  // Verify displayed content matches for groups (slug, title, description)
  for (const expected of PUBLISHED_ACTIVITY_GROUPS) {
    const found = renderedGroups.find((g) => g.slug === expected.slug)!;
    assert.equal(found.title, expected.title, `Group '${expected.slug}' title mismatch`);
    assert.equal(found.description, expected.description, `Group '${expected.slug}' description mismatch`);
  }

  // Verify displayed content matches for missions (slug, title)
  const renderedWrongRecruit = renderedMissions.find((m) => m.slug === PUBLISHED_MISSION_SLUG)!;
  assert.equal(renderedWrongRecruit.title, PUBLISHED_MISSION_TITLE);
  assert.equal(renderedWrongRecruit.isActive, true);

  // Invented placeholders must not appear anywhere
  const allSlugs = new Set([...actualTrainingSlugs, ...actualGroupSlugs, ...actualMissionSlugs]);
  for (const invented of [...INVENTED_ACTIVITY_SLUGS, INVENTED_MISSION_SLUG]) {
    assert.ok(
      !allSlugs.has(invented),
      `Invented placeholder '${invented}' found in data-driven set — it has no DB backing`,
    );
  }
});

// ---------------------------------------------------------------------------
// Failure/fallback behavior (Requirement 6.6)
// ---------------------------------------------------------------------------

test("Property 18: Data-path parity — on failure, typed constants are retained (Req 6.6)", () => {
  // Requirement 6.6: IF parity fails for any single entity, THEN the system
  // SHALL retain the Hardcoded_Constants so that the Learner_UI continues to
  // render content.
  //
  // This test verifies the design contract: when the data-driven path returns
  // null/empty (simulating a failure), the fallback-merge helper returns the
  // fallback constants, ensuring the UI keeps rendering.

  // Simulate endpoint failure (null data)
  const fallbackEntries = [{ slug: "fallback-entry", title: "Fallback", description: "" }];
  const result = fallbackMerge(null, fallbackEntries);

  assert.equal(result.source, "fallback", "On failure, source should be 'fallback'");
  assert.deepEqual(result.entries, fallbackEntries, "On failure, fallback entries are retained");

  // Simulate endpoint returning empty array
  const emptyResult = fallbackMerge([], fallbackEntries);
  assert.equal(emptyResult.source, "fallback", "On empty data, source should be 'fallback'");
  assert.deepEqual(emptyResult.entries, fallbackEntries, "On empty data, fallback entries are retained");

  // Simulate endpoint success — data takes precedence
  const dataEntries = [{ slug: "real-data", title: "Real", description: "From DB" }];
  const successResult = fallbackMerge(dataEntries, fallbackEntries);
  assert.equal(successResult.source, "data", "On success, source should be 'data'");
  assert.deepEqual(successResult.entries, dataEntries, "On success, data entries are used");
});
