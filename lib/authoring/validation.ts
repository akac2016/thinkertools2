import { activityBodySchema } from "./activity-schema.ts";
import { missionBodySchema } from "./mission-schema.ts";
import type { DraftContentType, ValidationIssue } from "./draft-types.ts";
import {
  extractPromptClaims,
  normalizeLabelSelection,
} from "../quests/contradiction-spotting.ts";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate a draft body against the schema and business rules for its content
 * type. Returns an array of ValidationIssue objects; an empty array means the
 * draft is valid.
 */
export function validateDraft(
  contentType: DraftContentType,
  body: unknown
): ValidationIssue[] {
  if (contentType === "activity") {
    return validateActivity(body);
  }
  return validateMission(body);
}

// ---------------------------------------------------------------------------
// Activity validation (Req 4.1)
// ---------------------------------------------------------------------------

function validateActivity(body: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // 1. Zod parse
  const parsed = activityBodySchema.safeParse(body);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({
        path: issue.path.join("."),
        code: issue.code,
        message: issue.message,
      });
    }
    // If the schema parse failed we can't safely run the cross-field checks
    return issues;
  }

  const data = parsed.data;

  // 2. Unique claim labels — no two prompt_claims should parse to the same label
  const parsedClaims = extractPromptClaims({
    prompt_claims: data.prompt_claims,
  } as Parameters<typeof extractPromptClaims>[0]);

  const seenLabels = new Set<string>();
  const duplicateLabels = new Set<string>();
  for (const claim of parsedClaims) {
    if (seenLabels.has(claim.label)) {
      duplicateLabels.add(claim.label);
    }
    seenLabels.add(claim.label);
  }
  if (duplicateLabels.size > 0) {
    issues.push({
      path: "prompt_claims",
      code: "duplicate_claim_labels",
      message: `Duplicate claim labels found: ${[...duplicateLabels].join(", ")}`,
    });
  }

  // 3. Every correct_answer_label must resolve to an existing claim label
  const claimLabelSet = new Set(parsedClaims.map((c) => c.label));
  const normalizedCorrect = normalizeLabelSelection(data.correct_answer_labels);
  const missingLabels = normalizedCorrect.filter((l) => !claimLabelSet.has(l));
  if (missingLabels.length > 0) {
    issues.push({
      path: "correct_answer_labels",
      code: "unresolved_claim_label",
      message: `Correct answer labels do not reference existing claims: ${missingLabels.join(", ")}`,
    });
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Mission validation (Req 4.2)
// ---------------------------------------------------------------------------

function validateMission(body: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // 1. Zod parse
  const parsed = missionBodySchema.safeParse(body);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({
        path: issue.path.join("."),
        code: issue.code,
        message: issue.message,
      });
    }
    return issues;
  }

  const data = parsed.data;

  // Build lookup maps
  const stageIds = new Set(data.stages.map((s) => s.id));
  const actionById = new Map(data.actions.map((a) => [a.id, a]));
  const claimLabelSet = new Set(data.character_claims.map((c) => c.label));
  const resolutionOptionIds = new Set(data.resolution_options.map((o) => o.id));

  // 2. No dangling targetStageId — every action's target_stage_id must reference
  //    an existing stage id
  for (const action of data.actions) {
    if (action.target_stage_id !== undefined && !stageIds.has(action.target_stage_id)) {
      issues.push({
        path: `actions[id=${action.id}].target_stage_id`,
        code: "dangling_target_stage_id",
        message: `Action "${action.id}" references non-existent stage "${action.target_stage_id}"`,
      });
    }
  }

  // 3. Graph reachability — confirm a path exists from the first stage to a
  //    stage that has an action with kind "complete"
  if (data.stages.length > 0) {
    const firstStageId = data.stages[0].id;

    // Build adjacency: stageId → set of reachable stageIds via actions
    // A stage's actions are those whose id appears in stage.action_ids
    const adjacency = new Map<string, Set<string>>();
    for (const stage of data.stages) {
      const reachable = new Set<string>();
      for (const actionId of stage.action_ids) {
        const action = actionById.get(actionId);
        if (action?.target_stage_id && stageIds.has(action.target_stage_id)) {
          reachable.add(action.target_stage_id);
        }
      }
      adjacency.set(stage.id, reachable);
    }

    // Find stages that have a "complete" action
    const completeStageIds = new Set<string>();
    for (const stage of data.stages) {
      for (const actionId of stage.action_ids) {
        const action = actionById.get(actionId);
        if (action?.kind === "complete") {
          completeStageIds.add(stage.id);
        }
      }
    }

    if (completeStageIds.size === 0) {
      issues.push({
        path: "actions",
        code: "no_complete_action",
        message: 'No action with kind "complete" found in any stage',
      });
    } else {
      // BFS from first stage
      const visited = new Set<string>();
      const queue: string[] = [firstStageId];
      visited.add(firstStageId);

      while (queue.length > 0) {
        const current = queue.shift()!;
        const neighbors = adjacency.get(current) ?? new Set();
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }

      const reachableCompleteStages = [...completeStageIds].filter((id) =>
        visited.has(id)
      );

      if (reachableCompleteStages.length === 0) {
        issues.push({
          path: "stages",
          code: "unreachable_debrief",
          message:
            'No path exists from the first stage to a stage with a "complete" action (debrief unreachable)',
        });
      }
    }
  }

  // 4. contradiction_review.correct_claim_labels must reference existing
  //    character_claim labels
  for (const label of data.contradiction_review.correct_claim_labels) {
    if (!claimLabelSet.has(label)) {
      issues.push({
        path: "contradiction_review.correct_claim_labels",
        code: "missing_claim_label",
        message: `contradiction_review references non-existent claim label "${label}"`,
      });
    }
  }

  // 5. resolution_review.best_option_id must reference an existing
  //    resolution_option id
  if (!resolutionOptionIds.has(data.resolution_review.best_option_id)) {
    issues.push({
      path: "resolution_review.best_option_id",
      code: "missing_resolution_option",
      message: `resolution_review.best_option_id "${data.resolution_review.best_option_id}" does not reference an existing resolution option`,
    });
  }

  return issues;
}
