import assert from "node:assert/strict";
import test from "node:test";

import { deriveActivityAuthoringState } from "../lib/authoring/activity-authoring-state.ts";

const TRAINING_ID = "00000000-0000-4000-8000-000000000001";
const GROUP_ID = "00000000-0000-4000-8000-000000000002";

test("activity authoring is unavailable before a subject is selected", () => {
  const state = deriveActivityAuthoringState({
    subjectTrainingId: null,
    selectedContentType: null,
    hasDraft: false,
    activityGroupId: null,
    draftStatus: null,
  });

  assert.deepEqual(state, {
    subjectSelected: false,
    activityFormatSelected: false,
    exploratoryUngroupedDraftAllowed: false,
    needsActivityGroup: false,
    groupSelected: false,
    readyForMultiQuestionGeneration: false,
    readyToPublish: false,
  });
});

test("selecting subject and activity format allows an exploratory ungrouped draft", () => {
  const state = deriveActivityAuthoringState({
    subjectTrainingId: TRAINING_ID,
    selectedContentType: "activity",
    hasDraft: false,
    activityGroupId: null,
    draftStatus: null,
  });

  assert.equal(state.subjectSelected, true);
  assert.equal(state.activityFormatSelected, true);
  assert.equal(state.exploratoryUngroupedDraftAllowed, true);
  assert.equal(state.needsActivityGroup, false);
  assert.equal(state.readyForMultiQuestionGeneration, false);
  assert.equal(state.readyToPublish, false);
});

test("an ungrouped activity draft needs a group and cannot batch or publish", () => {
  const state = deriveActivityAuthoringState({
    subjectTrainingId: TRAINING_ID,
    selectedContentType: "activity",
    hasDraft: true,
    activityGroupId: null,
    draftStatus: "valid",
  });

  assert.equal(state.exploratoryUngroupedDraftAllowed, true);
  assert.equal(state.needsActivityGroup, true);
  assert.equal(state.groupSelected, false);
  assert.equal(state.readyForMultiQuestionGeneration, false);
  assert.equal(state.readyToPublish, false);
});

test("a grouped activity draft can generate a batch but cannot publish until valid", () => {
  const state = deriveActivityAuthoringState({
    subjectTrainingId: TRAINING_ID,
    selectedContentType: "activity",
    hasDraft: true,
    activityGroupId: GROUP_ID,
    draftStatus: "draft",
  });

  assert.equal(state.needsActivityGroup, false);
  assert.equal(state.groupSelected, true);
  assert.equal(state.readyForMultiQuestionGeneration, true);
  assert.equal(state.readyToPublish, false);
});

test("a valid grouped activity draft is ready to publish", () => {
  const state = deriveActivityAuthoringState({
    subjectTrainingId: TRAINING_ID,
    selectedContentType: "activity",
    hasDraft: true,
    activityGroupId: GROUP_ID,
    draftStatus: "valid",
  });

  assert.equal(state.groupSelected, true);
  assert.equal(state.readyForMultiQuestionGeneration, true);
  assert.equal(state.readyToPublish, true);
});

test("mission drafts do not enter activity authoring states", () => {
  const state = deriveActivityAuthoringState({
    subjectTrainingId: TRAINING_ID,
    selectedContentType: "mission",
    hasDraft: true,
    activityGroupId: GROUP_ID,
    draftStatus: "valid",
  });

  assert.equal(state.activityFormatSelected, false);
  assert.equal(state.needsActivityGroup, false);
  assert.equal(state.groupSelected, false);
  assert.equal(state.readyForMultiQuestionGeneration, false);
  assert.equal(state.readyToPublish, false);
});
