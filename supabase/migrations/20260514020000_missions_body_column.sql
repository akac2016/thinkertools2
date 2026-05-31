-- Migration: add mission_body column to missions table and backfill wrong-recruit
-- Additive only: no existing columns are dropped or modified.

set search_path = public;

alter table public.missions
  add column if not exists mission_body jsonb not null default '{}'::jsonb;

-- Backfill the canonical wrong-recruit mission body so the existing mission
-- works through the data-driven path unchanged. The JSON below mirrors
-- lib/missions/wrong-recruit.ts serialized with snake_case keys matching
-- lib/authoring/mission-schema.ts (missionBodySchema).
update public.missions
set mission_body = '{
  "narrative_hook": "A mild bureaucratic mix-up pulls the player into a temporal reasoning case they were not supposed to receive.",
  "short_description": "Review a medicine theft dispute, identify the central contradiction, and recommend the most coherent resolution.",
  "difficulty_label": "intro",
  "required_training_level": 1,
  "xp_reward": 60,
  "stages": [
    {
      "id": "intake",
      "title": "Intake and mistaken assignment",
      "objective": "Accept the mistaken assignment and open Case 7B.",
      "guide_messages": [
        "Intake record mismatch detected.",
        "You are not the recruit we expected.",
        "But you are the recruit we currently have.",
        "The assigned recruit is unavailable. Reassignment reversal is not currently practical.",
        "You are now attached to Case 7B: Medicine Dispute Review.",
        "You have been selected through a combination of clerical error, temporal inconvenience, and current staffing constraints.",
        "Please review the case materials before making any further mistakes."
      ],
      "action_ids": ["accept-assignment", "inspect-brief"],
      "revealed_fact_ids": ["intake-mismatch", "case-opened"]
    },
    {
      "id": "briefing",
      "title": "Case briefing and claim intake",
      "objective": "Inspect the four dispute statements and collect the core facts.",
      "guide_messages": [
        "A medicine theft has occurred in a community under pressure.",
        "The dispute is not only about whether a rule was broken. It is about whether the community''s principles still cohere under emergency pressure.",
        "Inspect each statement before moving to contradiction review."
      ],
      "action_ids": [
        "inspect-rule-keeper",
        "inspect-medicine-taker",
        "inspect-defender",
        "inspect-precedent-resident",
        "move-to-contradiction-review"
      ],
      "revealed_fact_ids": ["medicine-theft", "community-pressure", "four-dispute-roles"]
    },
    {
      "id": "contradiction-review",
      "title": "Contradiction review",
      "objective": "Choose the two claims in strongest conflict.",
      "guide_messages": [
        "The strongest contradiction is not just that one person stole and another dislikes theft.",
        "Look for the place where a rule, an exception, and a practical decision can no longer all fit together."
      ],
      "action_ids": ["select-contradiction", "review-statements"],
      "revealed_fact_ids": ["claims-ready-for-review"]
    },
    {
      "id": "resolution-choice",
      "title": "Resolution choice",
      "objective": "Recommend the most coherent way to resolve the dispute.",
      "guide_messages": [
        "Finding a contradiction is only the first move.",
        "The final recommendation should preserve what still matters in the rule while repairing the case the rule cannot currently handle."
      ],
      "action_ids": ["select-resolution", "review-contradiction"],
      "revealed_fact_ids": ["central-contradiction"]
    },
    {
      "id": "debrief",
      "title": "Debrief and progression handoff",
      "objective": "Complete the Mission and return to the Training loop.",
      "guide_messages": [
        "Case 7B is ready to close.",
        "Contradictions matter because they shape decisions, not just opinions.",
        "Next recommended content: Contradiction Spotting practice and challenge rounds."
      ],
      "action_ids": ["complete-mission", "go-to-contradiction-spotting", "return-to-dashboard"],
      "revealed_fact_ids": ["coherent-resolution", "mission-handoff"]
    }
  ],
  "actions": [
    {
      "id": "accept-assignment",
      "label": "Accept assignment",
      "kind": "continue",
      "target_stage_id": "briefing"
    },
    {
      "id": "inspect-brief",
      "label": "Inspect brief",
      "kind": "inspect",
      "target_stage_id": "briefing"
    },
    {
      "id": "inspect-rule-keeper",
      "label": "Inspect A",
      "kind": "inspect"
    },
    {
      "id": "inspect-medicine-taker",
      "label": "Inspect B",
      "kind": "inspect"
    },
    {
      "id": "inspect-defender",
      "label": "Inspect C",
      "kind": "inspect"
    },
    {
      "id": "inspect-precedent-resident",
      "label": "Inspect D",
      "kind": "inspect"
    },
    {
      "id": "move-to-contradiction-review",
      "label": "Move to contradiction review",
      "kind": "continue",
      "target_stage_id": "contradiction-review"
    },
    {
      "id": "select-contradiction",
      "label": "Select two claims",
      "kind": "select-contradiction",
      "target_stage_id": "resolution-choice"
    },
    {
      "id": "review-statements",
      "label": "Review statements",
      "kind": "inspect",
      "target_stage_id": "briefing"
    },
    {
      "id": "select-resolution",
      "label": "Submit recommendation",
      "kind": "select-resolution",
      "target_stage_id": "debrief"
    },
    {
      "id": "review-contradiction",
      "label": "Review contradiction",
      "kind": "inspect",
      "target_stage_id": "contradiction-review"
    },
    {
      "id": "complete-mission",
      "label": "Complete Mission",
      "kind": "complete"
    },
    {
      "id": "go-to-contradiction-spotting",
      "label": "Go to Contradiction Spotting",
      "kind": "handoff"
    },
    {
      "id": "return-to-dashboard",
      "label": "Return to dashboard",
      "kind": "handoff"
    }
  ],
  "facts": [
    {
      "id": "intake-mismatch",
      "label": "Intake mismatch",
      "body": "The intake record does not match the current recruit, but the system has attached the player to the case anyway."
    },
    {
      "id": "case-opened",
      "label": "Case 7B",
      "body": "Case 7B is a Medicine Dispute Review caused by a theft under urgent community pressure."
    },
    {
      "id": "medicine-theft",
      "label": "Medicine theft",
      "body": "Medicine was taken without permission during an urgent illness."
    },
    {
      "id": "community-pressure",
      "label": "Community pressure",
      "body": "The community depends on shared rules, limited trust, and scarce medical supplies."
    },
    {
      "id": "four-dispute-roles",
      "label": "Four dispute roles",
      "body": "The case includes a rule-keeper, the medicine-taker, a defender of the theft, and a resident worried about precedent."
    },
    {
      "id": "claim-rule-keeper",
      "label": "Claim A",
      "body": "The rule-keeper says rules must apply equally or shared trust breaks down."
    },
    {
      "id": "claim-medicine-taker",
      "label": "Claim B",
      "body": "The medicine-taker says the medicine was taken because an immediate untreated illness could become fatal."
    },
    {
      "id": "claim-defender",
      "label": "Claim C",
      "body": "The defender says preventing unnecessary death can override the rule against theft."
    },
    {
      "id": "claim-precedent-resident",
      "label": "Claim D",
      "body": "The precedent-worried resident says excusing the theft without a rule change would weaken trust and consistency."
    },
    {
      "id": "claims-ready-for-review",
      "label": "Claims ready",
      "body": "All four claims are available for pair selection in contradiction review."
    },
    {
      "id": "central-contradiction",
      "label": "Central contradiction",
      "body": "The community treats equal rule enforcement as necessary while also treating emergency prevention of death as morally urgent, but the rule framework does not specify narrow emergency exceptions."
    },
    {
      "id": "coherent-resolution",
      "label": "Coherent resolution",
      "body": "The strongest resolution acknowledges the theft as a violation while revising the rule framework to allow narrow emergency exceptions."
    },
    {
      "id": "mission-handoff",
      "label": "Training handoff",
      "body": "After completion, the player should be guided back into Contradiction Spotting practice and challenge rounds."
    }
  ],
  "character_claims": [
    {
      "id": "rule-keeper",
      "label": "A",
      "character_name": "Rule-keeper",
      "role": "Emphasizes rules and social order.",
      "statement": "Rules must apply equally. If theft is allowed here, shared trust breaks down for everyone.",
      "revealed_fact_ids": ["claim-rule-keeper"]
    },
    {
      "id": "medicine-taker",
      "label": "B",
      "character_name": "Medicine-taker",
      "role": "Took the medicine under urgent circumstances.",
      "statement": "I took the medicine because waiting would have put a life at serious risk.",
      "revealed_fact_ids": ["claim-medicine-taker"]
    },
    {
      "id": "defender",
      "label": "C",
      "character_name": "Defender of the theft",
      "role": "Argues that saving a life overrides the rule.",
      "statement": "When a life is at stake, preventing unnecessary death can override the rule against theft.",
      "revealed_fact_ids": ["claim-defender"]
    },
    {
      "id": "precedent-resident",
      "label": "D",
      "character_name": "Resident worried about precedent",
      "role": "Worries that an unchecked exception weakens consistency.",
      "statement": "If this is excused with no rule change, no one will know when the medicine rules still count.",
      "revealed_fact_ids": ["claim-precedent-resident"]
    }
  ],
  "contradiction_review": {
    "stage_id": "contradiction-review",
    "prompt": "Which two claims are in strongest contradiction?",
    "claim_ids": ["rule-keeper", "medicine-taker", "defender", "precedent-resident"],
    "correct_claim_labels": ["A", "C"],
    "correct_claim_ids": ["rule-keeper", "defender"],
    "explanation": "Claim A requires equal rule enforcement to preserve trust, while Claim C says an emergency can override the rule. The current framework does not explain how both principles can guide this case."
  },
  "resolution_options": [
    {
      "id": "punish-fully",
      "label": "A",
      "body": "Punish the theft fully and reaffirm the rule with no change.",
      "feedback": "This preserves the rule but ignores the emergency pressure that made the rule framework unstable."
    },
    {
      "id": "excuse-entirely",
      "label": "B",
      "body": "Excuse the theft entirely and ignore the rule violation.",
      "feedback": "This recognizes the emergency but makes the rule too easy to discard without a principled boundary."
    },
    {
      "id": "revise-narrow-exceptions",
      "label": "C",
      "body": "Acknowledge the theft as a violation, but revise the rule framework to allow narrow emergency exceptions.",
      "feedback": "This preserves the importance of rules while making room for emergency moral pressure under defined conditions."
    },
    {
      "id": "defer-judgment",
      "label": "D",
      "body": "Avoid judgment and defer the issue entirely.",
      "feedback": "This avoids the hard decision but leaves the contradiction unresolved for the next emergency."
    }
  ],
  "resolution_review": {
    "stage_id": "resolution-choice",
    "prompt": "Which recommendation best resolves the case?",
    "option_ids": ["punish-fully", "excuse-entirely", "revise-narrow-exceptions", "defer-judgment"],
    "best_option_id": "revise-narrow-exceptions",
    "explanation": "The strongest answer is to acknowledge the theft as a violation while revising the rule framework to allow narrow emergency exceptions. It preserves rule consistency, recognizes emergency need, and repairs the incoherent principle instead of simply choosing a side."
  },
  "debrief": {
    "completion_message": "Mission complete: The Wrong Recruit.",
    "takeaway": "Philosophical reasoning is not just having opinions. It is finding where beliefs, rules, and actions fail to cohere, then repairing the principle that no longer fits the case.",
    "handoff_message": "Return to Contradiction Spotting to keep practicing how to find the claims that cannot both hold."
  }
}'::jsonb
where slug = 'wrong-recruit'
  and mission_body = '{}'::jsonb;
