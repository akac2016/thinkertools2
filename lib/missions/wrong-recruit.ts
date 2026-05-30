import { ACTIVE_TRAINING_SLUG } from "../quests";

import type { MissionDefinition } from "./domain-types";

export const WRONG_RECRUIT_MISSION_SLUG = "wrong-recruit" as const;
export const WRONG_RECRUIT_MISSION_XP_REWARD = 60 as const;

export const wrongRecruitMission = {
  id: WRONG_RECRUIT_MISSION_SLUG,
  slug: WRONG_RECRUIT_MISSION_SLUG,
  title: "The Wrong Recruit",
  trainingSlug: ACTIVE_TRAINING_SLUG,
  trainingTitle: "Philosophical Reasoning",
  missionType: "Introductory milestone Mission",
  narrativeHook:
    "A mild bureaucratic mix-up pulls the player into a temporal reasoning case they were not supposed to receive.",
  shortDescription:
    "Review a medicine theft dispute, identify the central contradiction, and recommend the most coherent resolution.",
  difficultyLabel: "intro",
  requiredTrainingLevel: 1,
  xpReward: WRONG_RECRUIT_MISSION_XP_REWARD,
  completionCriteria:
    "Complete intake, inspect the case claims, identify the strongest contradiction, choose a final resolution, and finish the debrief.",
  nextRecommendedActivitySlug: "contradiction-spotting",
  source: {
    title: "ThinkerTools Re-design - the wrong recruit.pdf",
    note: "Canonical MVP mission content extracted from the supplied PDF. Keep the PDF as reference; the app should load this structured mission data.",
  },
  stages: [
    {
      id: "intake",
      title: "Intake and mistaken assignment",
      objective: "Accept the mistaken assignment and open Case 7B.",
      guideMessages: [
        "Intake record mismatch detected.",
        "You are not the recruit we expected.",
        "But you are the recruit we currently have.",
        "The assigned recruit is unavailable. Reassignment reversal is not currently practical.",
        "You are now attached to Case 7B: Medicine Dispute Review.",
        "You have been selected through a combination of clerical error, temporal inconvenience, and current staffing constraints.",
        "Please review the case materials before making any further mistakes.",
      ],
      actionIds: ["accept-assignment", "inspect-brief"],
      revealedFactIds: ["intake-mismatch", "case-opened"],
    },
    {
      id: "briefing",
      title: "Case briefing and claim intake",
      objective: "Inspect the four dispute statements and collect the core facts.",
      guideMessages: [
        "A medicine theft has occurred in a community under pressure.",
        "The dispute is not only about whether a rule was broken. It is about whether the community's principles still cohere under emergency pressure.",
        "Inspect each statement before moving to contradiction review.",
      ],
      actionIds: [
        "inspect-rule-keeper",
        "inspect-medicine-taker",
        "inspect-defender",
        "inspect-precedent-resident",
        "move-to-contradiction-review",
      ],
      revealedFactIds: ["medicine-theft", "community-pressure", "four-dispute-roles"],
    },
    {
      id: "contradiction-review",
      title: "Contradiction review",
      objective: "Choose the two claims in strongest conflict.",
      guideMessages: [
        "The strongest contradiction is not just that one person stole and another dislikes theft.",
        "Look for the place where a rule, an exception, and a practical decision can no longer all fit together.",
      ],
      actionIds: ["select-contradiction", "review-statements"],
      revealedFactIds: ["claims-ready-for-review"],
    },
    {
      id: "resolution-choice",
      title: "Resolution choice",
      objective: "Recommend the most coherent way to resolve the dispute.",
      guideMessages: [
        "Finding a contradiction is only the first move.",
        "The final recommendation should preserve what still matters in the rule while repairing the case the rule cannot currently handle.",
      ],
      actionIds: ["select-resolution", "review-contradiction"],
      revealedFactIds: ["central-contradiction"],
    },
    {
      id: "debrief",
      title: "Debrief and progression handoff",
      objective: "Complete the Mission and return to the Training loop.",
      guideMessages: [
        "Case 7B is ready to close.",
        "Contradictions matter because they shape decisions, not just opinions.",
        "Next recommended content: Contradiction Spotting practice and challenge rounds.",
      ],
      actionIds: ["complete-mission", "go-to-contradiction-spotting", "return-to-dashboard"],
      revealedFactIds: ["coherent-resolution", "mission-handoff"],
    },
  ],
  actions: [
    {
      id: "accept-assignment",
      label: "Accept assignment",
      kind: "continue",
      targetStageId: "briefing",
    },
    {
      id: "inspect-brief",
      label: "Inspect brief",
      kind: "inspect",
      targetStageId: "briefing",
    },
    {
      id: "inspect-rule-keeper",
      label: "Inspect A",
      kind: "inspect",
    },
    {
      id: "inspect-medicine-taker",
      label: "Inspect B",
      kind: "inspect",
    },
    {
      id: "inspect-defender",
      label: "Inspect C",
      kind: "inspect",
    },
    {
      id: "inspect-precedent-resident",
      label: "Inspect D",
      kind: "inspect",
    },
    {
      id: "move-to-contradiction-review",
      label: "Move to contradiction review",
      kind: "continue",
      targetStageId: "contradiction-review",
    },
    {
      id: "select-contradiction",
      label: "Select two claims",
      kind: "select-contradiction",
      targetStageId: "resolution-choice",
    },
    {
      id: "review-statements",
      label: "Review statements",
      kind: "inspect",
      targetStageId: "briefing",
    },
    {
      id: "select-resolution",
      label: "Submit recommendation",
      kind: "select-resolution",
      targetStageId: "debrief",
    },
    {
      id: "review-contradiction",
      label: "Review contradiction",
      kind: "inspect",
      targetStageId: "contradiction-review",
    },
    {
      id: "complete-mission",
      label: "Complete Mission",
      kind: "complete",
    },
    {
      id: "go-to-contradiction-spotting",
      label: "Go to Contradiction Spotting",
      kind: "handoff",
    },
    {
      id: "return-to-dashboard",
      label: "Return to dashboard",
      kind: "handoff",
    },
  ],
  facts: [
    {
      id: "intake-mismatch",
      label: "Intake mismatch",
      body: "The intake record does not match the current recruit, but the system has attached the player to the case anyway.",
    },
    {
      id: "case-opened",
      label: "Case 7B",
      body: "Case 7B is a Medicine Dispute Review caused by a theft under urgent community pressure.",
    },
    {
      id: "medicine-theft",
      label: "Medicine theft",
      body: "Medicine was taken without permission during an urgent illness.",
    },
    {
      id: "community-pressure",
      label: "Community pressure",
      body: "The community depends on shared rules, limited trust, and scarce medical supplies.",
    },
    {
      id: "four-dispute-roles",
      label: "Four dispute roles",
      body: "The case includes a rule-keeper, the medicine-taker, a defender of the theft, and a resident worried about precedent.",
    },
    {
      id: "claim-rule-keeper",
      label: "Claim A",
      body: "The rule-keeper says rules must apply equally or shared trust breaks down.",
    },
    {
      id: "claim-medicine-taker",
      label: "Claim B",
      body: "The medicine-taker says the medicine was taken because an immediate untreated illness could become fatal.",
    },
    {
      id: "claim-defender",
      label: "Claim C",
      body: "The defender says preventing unnecessary death can override the rule against theft.",
    },
    {
      id: "claim-precedent-resident",
      label: "Claim D",
      body: "The precedent-worried resident says excusing the theft without a rule change would weaken trust and consistency.",
    },
    {
      id: "claims-ready-for-review",
      label: "Claims ready",
      body: "All four claims are available for pair selection in contradiction review.",
    },
    {
      id: "central-contradiction",
      label: "Central contradiction",
      body: "The community treats equal rule enforcement as necessary while also treating emergency prevention of death as morally urgent, but the rule framework does not specify narrow emergency exceptions.",
    },
    {
      id: "coherent-resolution",
      label: "Coherent resolution",
      body: "The strongest resolution acknowledges the theft as a violation while revising the rule framework to allow narrow emergency exceptions.",
    },
    {
      id: "mission-handoff",
      label: "Training handoff",
      body: "After completion, the player should be guided back into Contradiction Spotting practice and challenge rounds.",
    },
  ],
  characterClaims: [
    {
      id: "rule-keeper",
      label: "A",
      characterName: "Rule-keeper",
      role: "Emphasizes rules and social order.",
      statement: "Rules must apply equally. If theft is allowed here, shared trust breaks down for everyone.",
      revealedFactIds: ["claim-rule-keeper"],
    },
    {
      id: "medicine-taker",
      label: "B",
      characterName: "Medicine-taker",
      role: "Took the medicine under urgent circumstances.",
      statement: "I took the medicine because waiting would have put a life at serious risk.",
      revealedFactIds: ["claim-medicine-taker"],
    },
    {
      id: "defender",
      label: "C",
      characterName: "Defender of the theft",
      role: "Argues that saving a life overrides the rule.",
      statement: "When a life is at stake, preventing unnecessary death can override the rule against theft.",
      revealedFactIds: ["claim-defender"],
    },
    {
      id: "precedent-resident",
      label: "D",
      characterName: "Resident worried about precedent",
      role: "Worries that an unchecked exception weakens consistency.",
      statement: "If this is excused with no rule change, no one will know when the medicine rules still count.",
      revealedFactIds: ["claim-precedent-resident"],
    },
  ],
  contradictionReview: {
    stageId: "contradiction-review",
    prompt: "Which two claims are in strongest contradiction?",
    claimIds: ["rule-keeper", "medicine-taker", "defender", "precedent-resident"],
    correctClaimLabels: ["A", "C"],
    correctClaimIds: ["rule-keeper", "defender"],
    explanation:
      "Claim A requires equal rule enforcement to preserve trust, while Claim C says an emergency can override the rule. The current framework does not explain how both principles can guide this case.",
  },
  resolutionOptions: [
    {
      id: "punish-fully",
      label: "A",
      body: "Punish the theft fully and reaffirm the rule with no change.",
      feedback:
        "This preserves the rule but ignores the emergency pressure that made the rule framework unstable.",
    },
    {
      id: "excuse-entirely",
      label: "B",
      body: "Excuse the theft entirely and ignore the rule violation.",
      feedback:
        "This recognizes the emergency but makes the rule too easy to discard without a principled boundary.",
    },
    {
      id: "revise-narrow-exceptions",
      label: "C",
      body: "Acknowledge the theft as a violation, but revise the rule framework to allow narrow emergency exceptions.",
      feedback:
        "This preserves the importance of rules while making room for emergency moral pressure under defined conditions.",
    },
    {
      id: "defer-judgment",
      label: "D",
      body: "Avoid judgment and defer the issue entirely.",
      feedback:
        "This avoids the hard decision but leaves the contradiction unresolved for the next emergency.",
    },
  ],
  resolutionReview: {
    stageId: "resolution-choice",
    prompt: "Which recommendation best resolves the case?",
    optionIds: ["punish-fully", "excuse-entirely", "revise-narrow-exceptions", "defer-judgment"],
    bestOptionId: "revise-narrow-exceptions",
    explanation:
      "The strongest answer is to acknowledge the theft as a violation while revising the rule framework to allow narrow emergency exceptions. It preserves rule consistency, recognizes emergency need, and repairs the incoherent principle instead of simply choosing a side.",
  },
  debrief: {
    completionMessage: "Mission complete: The Wrong Recruit.",
    takeaway:
      "Philosophical reasoning is not just having opinions. It is finding where beliefs, rules, and actions fail to cohere, then repairing the principle that no longer fits the case.",
    handoffMessage:
      "Return to Contradiction Spotting to keep practicing how to find the claims that cannot both hold.",
  },
} as const satisfies MissionDefinition;
