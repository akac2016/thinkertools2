export type MissionActionKind =
  | "continue"
  | "inspect"
  | "select-contradiction"
  | "select-resolution"
  | "complete"
  | "handoff";

export type MissionAction = {
  id: string;
  label: string;
  kind: MissionActionKind;
  targetStageId?: string;
};

export type MissionFact = {
  id: string;
  label: string;
  body: string;
};

export type MissionCharacterClaim = {
  id: string;
  label: "A" | "B" | "C" | "D";
  characterName: string;
  role: string;
  statement: string;
  revealedFactIds: readonly string[];
};

export type MissionStage = {
  id: string;
  title: string;
  objective: string;
  guideMessages: readonly string[];
  actionIds: readonly string[];
  revealedFactIds: readonly string[];
};

export type MissionContradictionReview = {
  stageId: string;
  prompt: string;
  claimIds: readonly string[];
  correctClaimLabels: readonly ["A", "C"];
  correctClaimIds: readonly [string, string];
  explanation: string;
};

export type MissionResolutionOption = {
  id: string;
  label: string;
  body: string;
  feedback: string;
};

export type MissionResolutionReview = {
  stageId: string;
  prompt: string;
  optionIds: readonly string[];
  bestOptionId: string;
  explanation: string;
};

export type MissionDefinition = {
  id: string;
  slug: string;
  title: string;
  trainingSlug: string;
  trainingTitle: string;
  missionType: string;
  narrativeHook: string;
  shortDescription: string;
  difficultyLabel: string;
  requiredTrainingLevel: number;
  xpReward: number;
  completionCriteria: string;
  nextRecommendedActivitySlug: string;
  source: {
    title: string;
    note: string;
  };
  stages: readonly MissionStage[];
  actions: readonly MissionAction[];
  facts: readonly MissionFact[];
  characterClaims: readonly MissionCharacterClaim[];
  contradictionReview: MissionContradictionReview;
  resolutionOptions: readonly MissionResolutionOption[];
  resolutionReview: MissionResolutionReview;
  debrief: {
    completionMessage: string;
    takeaway: string;
    handoffMessage: string;
  };
};
