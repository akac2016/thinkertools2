import type { DraftContentType, DraftStatus } from "@/lib/authoring/draft-types";

export type ActivityAuthoringStateInput = {
  subjectTrainingId: string | null;
  selectedContentType: DraftContentType | null;
  hasDraft: boolean;
  activityGroupId: string | null;
  draftStatus: DraftStatus | null;
};

export type ActivityAuthoringState = {
  subjectSelected: boolean;
  activityFormatSelected: boolean;
  exploratoryUngroupedDraftAllowed: boolean;
  needsActivityGroup: boolean;
  groupSelected: boolean;
  readyForMultiQuestionGeneration: boolean;
  readyToPublish: boolean;
};

/**
 * Derives activity-question authoring capabilities from persisted draft state
 * and the educator's current subject/format selections.
 *
 * These flags intentionally overlap. A valid grouped draft, for example, is
 * both ready for multi-question generation and ready to publish.
 */
export function deriveActivityAuthoringState(
  input: ActivityAuthoringStateInput,
): ActivityAuthoringState {
  const subjectSelected = Boolean(input.subjectTrainingId);
  const activityFormatSelected = input.selectedContentType === "activity";
  const activityAuthoringStarted = subjectSelected && activityFormatSelected;
  const groupSelected = activityAuthoringStarted && Boolean(input.activityGroupId);
  const hasActivityDraft = activityAuthoringStarted && input.hasDraft;

  return {
    subjectSelected,
    activityFormatSelected,
    exploratoryUngroupedDraftAllowed: activityAuthoringStarted && !groupSelected,
    needsActivityGroup: hasActivityDraft && !groupSelected,
    groupSelected,
    readyForMultiQuestionGeneration: hasActivityDraft && groupSelected,
    readyToPublish:
      hasActivityDraft && groupSelected && input.draftStatus === "valid",
  };
}
