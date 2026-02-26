import "server-only";

import { z } from "zod";

import { runStructuredAi } from "@/lib/ai/client";
import { jsonError, jsonSuccess } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  WOI_GAME_SELECT_COLUMNS,
  getTeamMembersOrdered,
  isTeamMember,
  jsonDbError,
  requireActorId,
  type WoiGameRow,
} from "@/lib/woi";

const requestSchema = z
  .object({
    prompt: z.preprocess(
      (value) => {
        if (typeof value !== "string") {
          return value;
        }
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
      },
      z.string().trim().min(1).max(500).optional(),
    ),
    teamId: z.preprocess(
      (value) => {
        if (typeof value !== "string") {
          return value;
        }
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
      },
      z.string().uuid().optional(),
    ),
    isPublic: z.boolean().optional().default(false),
    aiPlayerCount: z
      .number()
      .int()
      .min(0)
      .max(11)
      .optional(),
    opponents: z
      .array(
        z
          .object({
            codename: z.string().trim().min(1).max(80),
            narrative: z.string().trim().min(1).max(400),
            intelligence: z.enum(["novice", "analytical", "strategic", "expert"]),
            difficulty: z.enum(["easy", "medium", "hard", "adaptive"]),
            imageUrl: z.string().trim().url().or(z.string().startsWith("data:image/")),
          })
          .strict(),
      )
      .max(11)
      .optional(),
  })
  .strict();

const generatedGameSchema = z
  .object({
    game: z
      .object({
        question: z.string().trim().min(1).max(200),
        description: z.string().trim().min(1).max(1200),
      })
      .strict(),
    template: z
      .object({
        name: z.string().trim().min(1).max(140),
        objective: z.string().trim().min(1).max(800),
        category: z.enum(["structural", "functional", "process", "uncategorized"]),
        rules: z.array(z.string().trim().min(1).max(240)).min(3).max(7),
        moves: z.array(z.string().trim().min(1).max(240)).min(3).max(7),
        levels: z
          .array(
            z
              .object({
                name: z.string().trim().min(1).max(140),
                objective: z.string().trim().min(1).max(500),
              })
              .strict(),
          )
          .min(3)
          .max(5),
      })
      .strict(),
  })
  .strict();

type GeneratedGameSpec = z.infer<typeof generatedGameSchema>;

const DEFAULT_PROMPT = "Build a collaborative inquiry game with a clear question and a five-step progression.";

function clip(text: string, max: number) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, max - 1))}...`;
}

function buildMockGame(prompt: string): GeneratedGameSpec {
  const topic = clip(prompt, 80);
  return generatedGameSchema.parse({
    game: {
      question: `What evidence best answers: ${topic}?`,
      description:
        "Work together to build, refine, and validate a high-quality evidence list that answers the question.",
    },
    template: {
      name: `AI Quickstart: ${clip(topic, 60)}`,
      objective:
        "Create a well-structured evidence list with clear scope, minimal overlap, and strong team alignment.",
      category: "process",
      rules: [
        "Each item must directly support the main question.",
        "Keep item scope specific and testable.",
        "Avoid duplicates unless you explain the distinction.",
        "Use concise wording the whole team can interpret consistently.",
      ],
      moves: [
        "Add an item.",
        "Edit item wording.",
        "Merge overlapping items.",
        "Split one broad item into narrower items.",
        "Challenge an item and propose an improved version.",
      ],
      levels: [
        {
          name: "Draft list",
          objective: "Generate an initial set of plausible evidence items.",
        },
        {
          name: "Relevance review",
          objective: "Remove weak items and clarify why each remaining item matters.",
        },
        {
          name: "Structure pass",
          objective: "Merge, split, and reorder items for a coherent structure.",
        },
        {
          name: "Quality check",
          objective: "Improve precision and confirm scope consistency across items.",
        },
        {
          name: "Final alignment",
          objective: "Confirm team agreement on the final evidence list.",
        },
      ],
    },
  });
}

async function resolveTeamId(actorId: string, requestedTeamId?: string) {
  if (requestedTeamId) {
    const membership = await isTeamMember(requestedTeamId, actorId);
    if ("response" in membership) {
      return { response: membership.response };
    }
    if (membership.isMember) {
      return { teamId: requestedTeamId };
    }

    const { count, error } = await supabaseAdmin
      .from("teams")
      .select("id", { head: true, count: "exact" })
      .eq("id", requestedTeamId);

    if (error) {
      return { response: jsonDbError("Failed to verify team", error) };
    }

    if ((count ?? 0) === 0) {
      return {
        response: jsonError("Team not found", {
          status: 404,
          code: "TEAM_NOT_FOUND",
        }),
      };
    }

    return {
      response: jsonError("You are not a member of this team", {
        status: 403,
        code: "TEAM_FORBIDDEN",
      }),
    };
  }

  const { data, error } = await supabaseAdmin
    .from("team_members")
    .select("team_id")
    .eq("user_id", actorId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(1);

  if (error) {
    return { response: jsonDbError("Failed to resolve default team", error) };
  }

  const fallbackTeamId = data?.[0]?.team_id;
  if (!fallbackTeamId) {
    return {
      response: jsonError("No team available for this actor", {
        status: 409,
        code: "TEAM_REQUIRED",
      }),
    };
  }

  return { teamId: fallbackTeamId };
}

export async function POST(request: Request) {
  const actor = await requireActorId(request);
  if ("response" in actor) {
    return actor.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON", {
      status: 400,
      code: "INVALID_JSON",
    });
  }

  const parsedBody = requestSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("Invalid request body", {
      status: 400,
      code: "INVALID_BODY",
      details: parsedBody.error.flatten(),
    });
  }

  const teamResolution = await resolveTeamId(actor.actorId, parsedBody.data.teamId);
  if ("response" in teamResolution) {
    return teamResolution.response;
  }

  const membersResult = await getTeamMembersOrdered(teamResolution.teamId);
  if ("response" in membersResult) {
    return membersResult.response;
  }
  if (membersResult.members.length === 0) {
    return jsonError("Cannot create a game for a team with no members", {
      status: 409,
      code: "TEAM_EMPTY",
    });
  }

  const prompt = parsedBody.data.prompt ?? DEFAULT_PROMPT;

  const aiResult = await runStructuredAi({
    feature: "template_generation",
    schema: generatedGameSchema,
    schemaName: "woi_quickstart_game",
    systemPrompt:
      "You generate playable collaborative inquiry game setups. Return only strict JSON matching the schema.",
    userPrompt: [
      "Create a new WOI game setup from this request.",
      "Use concise labels and concrete level objectives.",
      "Requested prompt:",
      prompt,
    ].join("\n"),
    mockResponse: buildMockGame(prompt),
    createdBy: actor.actorId,
  });

  const generated = aiResult.output;

  const { data: createdTemplate, error: createTemplateError } = await supabaseAdmin
    .from("woi_templates")
    .insert({
      creator_id: actor.actorId,
      name: generated.template.name,
      objective: generated.template.objective,
      category: generated.template.category,
      is_public: false,
    })
    .select("id,creator_id,name,objective,category,is_public,created_at,updated_at")
    .single();

  if (createTemplateError) {
    return jsonDbError("Failed to create quickstart template", createTemplateError);
  }

  const rulesPayload = generated.template.rules.map((ruleText, index) => ({
    template_id: createdTemplate.id,
    order_index: index + 1,
    rule_text: ruleText,
  }));
  const { error: rulesError } = await supabaseAdmin
    .from("woi_template_rules")
    .insert(rulesPayload);
  if (rulesError) {
    return jsonDbError("Failed to create template rules", rulesError);
  }

  const movesPayload = generated.template.moves.map((moveText, index) => ({
    template_id: createdTemplate.id,
    order_index: index + 1,
    move_text: moveText,
  }));
  const { error: movesError } = await supabaseAdmin
    .from("woi_template_moves")
    .insert(movesPayload);
  if (movesError) {
    return jsonDbError("Failed to create template moves", movesError);
  }

  const levelsPayload = generated.template.levels.map((level, index) => ({
    template_id: createdTemplate.id,
    order_index: index + 1,
    level_name: level.name,
    level_objective: level.objective,
  }));
  const { error: levelsError } = await supabaseAdmin
    .from("woi_template_levels")
    .insert(levelsPayload);
  if (levelsError) {
    return jsonDbError("Failed to create template levels", levelsError);
  }

  const initialCurrentPlayerId = membersResult.members[0]?.user_id ?? null;

  const { data: createdGame, error: createGameError } = await supabaseAdmin
    .from("woi_games")
    .insert({
      template_id: createdTemplate.id,
      team_id: teamResolution.teamId,
      creator_id: actor.actorId,
      question: generated.game.question,
      description: generated.game.description,
      is_public: parsedBody.data.isPublic,
      status: "in_play",
      current_player_id: initialCurrentPlayerId,
    })
    .select(WOI_GAME_SELECT_COLUMNS)
    .single();

  if (createGameError) {
    return jsonDbError("Failed to create quickstart game", createGameError);
  }

  const providedOpponents = parsedBody.data.opponents ?? [];
  const providedAiPlayerCount =
    typeof parsedBody.data.aiPlayerCount === "number"
      ? parsedBody.data.aiPlayerCount
      : (providedOpponents.length > 0 ? providedOpponents.length : undefined);
  if (typeof providedAiPlayerCount === "number") {
    const { error: persistError } = await supabaseAdmin
      .from("woi_game_ai_profiles")
      .upsert(
        {
          game_id: createdGame.id,
          ai_player_count: providedAiPlayerCount,
          opponents: providedOpponents,
          created_by: actor.actorId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "game_id" },
      );

    if (persistError && persistError.code !== "42P01") {
      return jsonDbError("Failed to persist generated AI profiles", persistError);
    }
  }

  return jsonSuccess(
    {
      game: createdGame as WoiGameRow,
      template: createdTemplate,
      ai: {
        source: aiResult.source,
        model: aiResult.model,
        status: aiResult.status,
      },
    },
    { status: 201 },
  );
}
