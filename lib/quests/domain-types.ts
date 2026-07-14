export const MISSIONS_MAX_LEVEL = 20 as const;

export const ACTIVE_TRAINING_SLUG = "philosophical-reasoning" as const;

export const TRAINING_ACTIVITY_CONTENT_TYPE = "activity" as const;
export const ACTIVE_MISSION_CONTENT_TYPE = "mission" as const;

export type TrainingActivityContentType = typeof TRAINING_ACTIVITY_CONTENT_TYPE;
export type MissionContentType = typeof ACTIVE_MISSION_CONTENT_TYPE;

export type ContradictionSpottingRoundContent = {
  prompt_claims: string[];
  question_text: string;
  correct_answer_labels: string[];
  explanation: string;
  round_type: string;
};

export type TrainingActivityRoundContent =
  Partial<ContradictionSpottingRoundContent>
  & Record<string, unknown>;

export type TrainingRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  max_level: number;
  publication_status: 'pending' | 'live' | 'archived';
  created_at: string;
  updated_at: string;
};

export type TrainingActivityRow = {
  id: string;
  slug: string;
  title: string;
  primary_training_id: string;
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
  publication_status: 'pending' | 'live' | 'archived';
  created_at: string;
  updated_at: string;
};

export type MissionRow = {
  id: string;
  slug: string;
  title: string;
  primary_training_id: string;
  secondary_training_ids: string[];
  content_type: MissionContentType;
  narrative_hook: string;
  short_description: string;
  difficulty_label: string;
  required_training_level: number;
  prerequisite_training_activity_ids: string[];
  prerequisite_mission_ids: string[];
  completion_criteria: string;
  xp_reward: number;
  rewards_metadata: Record<string, unknown>;
  publication_status: 'pending' | 'live' | 'archived';
  created_at: string;
  updated_at: string;
};

export type UserTrainingProgressRow = {
  id: string;
  user_id: string;
  training_id: string;
  current_level: number;
  current_level_xp: number;
  total_xp: number;
  created_at: string;
  updated_at: string;
};

export type TrainingActivityAttemptRow = {
  id: string;
  user_id: string;
  training_id: string;
  training_activity_id: string;
  content_type: TrainingActivityContentType;
  was_successful: boolean;
  awarded_xp: number;
  completion_metadata: Record<string, unknown>;
  completed_at: string;
};

export type MissionCompletionRow = {
  id: string;
  user_id: string;
  training_id: string;
  mission_id: string;
  content_type: MissionContentType;
  awarded_xp: number;
  completion_metadata: Record<string, unknown>;
  completed_at: string;
};

export type TrainingProgress = {
  currentLevel: number;
  currentLevelXp: number;
  totalXp: number;
};

export type CompletionContentType =
  | TrainingActivityContentType
  | MissionContentType;
