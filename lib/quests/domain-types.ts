export const QUESTS_MAX_LEVEL = 20 as const;

export const QUESTS_ACTIVE_SKILL_SLUG = "philosophical-reasoning" as const;

export const TRAINING_ACTIVITY_CONTENT_TYPE = "practice" as const;
export const QUESTS_ACTIVE_QUEST_CONTENT_TYPE = "quest" as const;

export type TrainingActivityContentType = typeof TRAINING_ACTIVITY_CONTENT_TYPE;
export type QuestsQuestContentType = typeof QUESTS_ACTIVE_QUEST_CONTENT_TYPE;

export type QuestsContradictionSpottingRoundContent = {
  prompt_claims: string[];
  question_text: string;
  correct_answer_labels: string[];
  explanation: string;
  round_type: string;
};

export type TrainingActivityRoundContent =
  Partial<QuestsContradictionSpottingRoundContent>
  & Record<string, unknown>;

export type QuestsSkillRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  max_level: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type TrainingActivityRow = {
  id: string;
  slug: string;
  title: string;
  primary_skill_id: string;
  content_type: TrainingActivityContentType;
  template_family: string;
  short_description: string;
  difficulty_label: string;
  completion_criteria: string;
  xp_reward: number;
  recommended_level_min: number;
  recommended_level_max: number;
  overlevel_grace_levels: number;
  round_content: TrainingActivityRoundContent;
  repeatable: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type QuestsQuestRow = {
  id: string;
  slug: string;
  title: string;
  primary_skill_id: string;
  secondary_skill_ids: string[];
  content_type: QuestsQuestContentType;
  narrative_hook: string;
  short_description: string;
  difficulty_label: string;
  required_skill_level: number;
  prerequisite_training_activity_ids: string[];
  prerequisite_quest_ids: string[];
  completion_criteria: string;
  xp_reward: number;
  rewards_metadata: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type QuestsUserSkillProgressRow = {
  id: string;
  user_id: string;
  skill_id: string;
  current_level: number;
  current_level_xp: number;
  total_xp: number;
  created_at: string;
  updated_at: string;
};

export type TrainingActivityAttemptRow = {
  id: string;
  user_id: string;
  skill_id: string;
  training_activity_id: string;
  content_type: TrainingActivityContentType;
  was_successful: boolean;
  awarded_xp: number;
  completion_metadata: Record<string, unknown>;
  completed_at: string;
};

export type QuestsQuestCompletionRow = {
  id: string;
  user_id: string;
  skill_id: string;
  quest_id: string;
  content_type: QuestsQuestContentType;
  awarded_xp: number;
  completion_metadata: Record<string, unknown>;
  completed_at: string;
};

export type QuestsSkillProgress = {
  currentLevel: number;
  currentLevelXp: number;
  totalXp: number;
};

export type QuestsCompletionContentType =
  | TrainingActivityContentType
  | QuestsQuestContentType;
