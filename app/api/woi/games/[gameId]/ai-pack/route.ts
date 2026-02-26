import "server-only";

import OpenAI from "openai";
import { z } from "zod";

import { runStructuredAi } from "@/lib/ai/client";
import { env } from "@/lib/env";
import { jsonError, jsonSuccess } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  canActorReadGame,
  getGameById,
  getTeamMembersOrdered,
  getUsersByIds,
  jsonDbError,
  requireActorId,
  type TeamMemberRow,
  type UserRow,
} from "@/lib/woi";

const paramsSchema = z.object({
  gameId: z.string().uuid(),
});

const bodySchema = z
  .object({
    regenerateNonce: z.preprocess(
      (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
      z.string().max(80).optional(),
    ),
    aiPlayerCount: z.number().int().min(0).max(11).optional(),
  })
  .strict();

const rosterSchema = z
  .object({
    aiPlayers: z
      .array(
        z
          .object({
            codename: z.string().trim().min(1).max(80),
            persona: z.string().trim().min(1).max(240),
          })
          .strict(),
      )
      .max(12),
  })
  .strict();

const storedOpponentSchema = z
  .object({
    codename: z.string().trim().min(1).max(80),
    narrative: z.string().trim().min(1).max(400),
    intelligence: z.enum(["novice", "analytical", "strategic", "expert"]),
    difficulty: z.enum(["easy", "medium", "hard", "adaptive"]),
    imageUrl: z.string().trim().url().or(z.string().startsWith("data:image/")),
  })
  .strict();

type RouteContext = {
  params: Promise<{ gameId: string }>;
};

type TemplateMoveRow = {
  id: string;
  order_index: number;
  move_text: string;
};

type TemplateRuleRow = {
  id: string;
  order_index: number;
  rule_text: string;
};

type TemplateLevelRow = {
  id: string;
  order_index: number;
  level_name: string;
  level_objective: string;
};

type AiProfile = {
  codename: string;
  persona: string;
  narrative?: string | null;
  imageUrl?: string | null;
  intelligence?: "novice" | "analytical" | "strategic" | "expert" | null;
  difficulty?: "easy" | "medium" | "hard" | "adaptive" | null;
};

let openAIClient: OpenAI | null = null;

function getOpenAIClient() {
  if (!env.OPENAI_API_KEY) {
    return null;
  }

  if (!openAIClient) {
    openAIClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }

  return openAIClient;
}

function mapUsers(users: UserRow[]): Map<string, UserRow> {
  return new Map(users.map((user) => [user.id, user]));
}

function clip(text: string, max: number) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, max - 1))}...`;
}

function fallbackImageDataUrl(label: string, kind: "move" | "rule" | "level") {
  const seed = Math.abs(
    Array.from(`${kind}:${label}`).reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) | 0, 0),
  );
  const hueA = (seed % 80) + 18;
  const hueB = (hueA + 32) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="hsl(${hueA} 38% 86%)"/>
      <stop offset="100%" stop-color="hsl(${hueB} 26% 73%)"/>
    </linearGradient>
    <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="hsl(${(hueA + 180) % 360} 24% 72%)"/>
      <stop offset="100%" stop-color="hsl(${(hueB + 180) % 360} 24% 58%)"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="256" height="256" rx="28" fill="url(#sky)"/>
  <rect x="0" y="126" width="256" height="130" rx="0" fill="url(#water)"/>
  <path d="M0 122 C52 105, 94 112, 134 102 C174 93, 208 98, 256 86 L256 138 L0 138 Z" fill="rgba(255,255,255,0.2)"/>
  <path d="M0 150 C56 136, 114 146, 178 132 C214 124, 232 126, 256 120 L256 166 L0 176 Z" fill="rgba(172,150,122,0.24)"/>
  <rect x="14" y="14" width="228" height="228" rx="20" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.24)"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function inferImageIntent(input: { kind: "move" | "rule" | "level"; label: string }): string {
  const text = input.label.toLowerCase();
  if (input.kind === "move") {
    if (/\bcause|why|origin|driver\b/.test(text)) {
      return "Show structural strain and root forces building over time; depict a clear origin mechanism.";
    }
    if (/\bconsequence|effect|impact|result\b/.test(text)) {
      return "Show downstream effects rippling outward from one event into multiple visible outcomes.";
    }
    if (/\bchallenge|counter|critique|rebut\b/.test(text)) {
      return "Show tension between competing interpretations, with visual conflict and contrast.";
    }
    if (/\bevidence|source|cite|proof\b/.test(text)) {
      return "Show investigators examining concrete artifacts, records, or physical clues.";
    }
    if (/\bquestion|ask|clarify\b/.test(text)) {
      return "Show inquiry and uncertainty through exploration, searching, and discovery.";
    }
    if (/\bconnect|synthesize|link\b/.test(text)) {
      return "Show multiple strands converging into one coherent understanding.";
    }
  }

  if (input.kind === "rule") {
    return "Show order, constraints, and boundaries shaping behavior within the scene.";
  }

  return "Show staged progression across space, from early foundations to advanced outcomes.";
}

async function generateSpinnerImage(input: {
  label: string;
  question: string;
  kind: "move" | "rule" | "level";
  nonce: string;
}) {
  // The workspace currently renders only move spinner imagery.
  // Keep rule/level tiles lightweight to avoid long image-generation latency.
  if (input.kind !== "move") {
    return fallbackImageDataUrl(input.label, input.kind);
  }

  const client = getOpenAIClient();
  if (!client) {
    return fallbackImageDataUrl(input.label, input.kind);
  }

  const intent = inferImageIntent({ kind: input.kind, label: input.label });
  const prompt = [
    "Create a single square painting in a Romantic historical landscape style with Hudson River School atmosphere and Neoclassical architectural influence.",
    "Use luminous natural light, cinematic depth, painterly brushwork, atmospheric haze, and a grand sense of scale.",
    `Topic context: ${input.question}.`,
    `Gameplay action concept (semantic reference only; never render text): ${input.label}.`,
    `Tile intent category: ${input.kind}.`,
    `Narrative direction: ${intent}`,
    "The image must communicate this action through tangible scene storytelling, not symbols.",
    "Absolutely no visible text, letters, numbers, glyphs, runes, inscriptions, captions, signs, banners, logos, or watermarks anywhere.",
    "Do not place writing on architecture, flags, books, maps, tablets, monuments, or sky.",
    "If text-like marks might appear, replace them with abstract painterly texture.",
    "No UI panels, no labels, no diagrams, no clip-art icons, no infographic arrows.",
    "No collage; one coherent scene.",
    `Variation seed: ${input.nonce}.`,
  ].join(" ");

  try {
    const response = await client.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "natural",
      response_format: "url",
      user: "woi-spinner",
    });

    const generatedUrl = response.data?.[0]?.url;
    if (generatedUrl) {
      return generatedUrl;
    }
  } catch (error) {
    console.error("Failed to generate spinner image", {
      kind: input.kind,
      label: input.label,
      error,
    });
  }

  return fallbackImageDataUrl(input.label, input.kind);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: limit }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index] as T, index);
    }
  });

  await Promise.all(workers);
  return results;
}

function buildRosterMock(count: number) {
  const codenames = [
    "Signal",
    "Atlas",
    "Vector",
    "Prism",
    "Flux",
    "Echo",
    "Harbor",
    "Orbit",
  ];
  const personas = [
    "focuses on concrete evidence quality",
    "prefers concise synthesis and tradeoffs",
    "pushes for edge-case testing",
    "looks for missing assumptions",
    "optimizes for team clarity",
    "prioritizes argument structure",
  ];

  return rosterSchema.parse({
    aiPlayers: Array.from({ length: count }, (_, index) => ({
      codename: `${codenames[index % codenames.length]} ${index + 1}`,
      persona: personas[index % personas.length] as string,
    })),
  });
}

function computeTurnForecast(input: {
  members: TeamMemberRow[];
  usersById: Map<string, UserRow>;
  aiProfiles: AiProfile[];
  currentPlayerId: string | null;
  humanPlayerId: string;
}) {
  const orderedIds = input.members.map((member) => member.user_id);
  if (orderedIds.length === 0) {
    return {
      turnsUntilHuman: null as number | null,
      queue: [] as Array<{
        userId: string;
        displayName: string;
        baseName: string;
        isHuman: boolean;
        isCurrent: boolean;
        turnOffset: number;
        persona: string | null;
        narrative: string | null;
        imageUrl: string | null;
        intelligence: "novice" | "analytical" | "strategic" | "expert" | null;
        difficulty: "easy" | "medium" | "hard" | "adaptive" | null;
      }>,
    };
  }

  const currentIndex =
    input.currentPlayerId !== null
      ? orderedIds.findIndex((id) => id === input.currentPlayerId)
      : -1;
  const startIndex = currentIndex >= 0 ? currentIndex : 0;
  const humanIndex = orderedIds.findIndex((id) => id === input.humanPlayerId);
  const turnsUntilHuman =
    humanIndex >= 0 ? (humanIndex - startIndex + orderedIds.length) % orderedIds.length : null;

  const nonHumanIds = orderedIds.filter((id) => id !== input.humanPlayerId);
  const personaByUserId = new Map<string, AiProfile>();
  nonHumanIds.forEach((userId, index) => {
    const profile = input.aiProfiles[index];
    if (profile) {
      personaByUserId.set(userId, profile);
    }
  });

  const queue = orderedIds.map((_, offset) => {
    const index = (startIndex + offset) % orderedIds.length;
    const userId = orderedIds[index] as string;
    const isHuman = userId === input.humanPlayerId;
    const user = input.usersById.get(userId);
    const baseName = user?.name || `Player ${index + 1}`;
    const profile = personaByUserId.get(userId) ?? null;

    return {
      userId,
      baseName,
      displayName: isHuman ? "You" : (profile?.codename ?? baseName),
      isHuman,
      isCurrent: offset === 0,
      turnOffset: offset,
      persona: isHuman ? "human player" : (profile?.persona ?? "AI teammate"),
      narrative: isHuman ? "Human player" : (profile?.narrative ?? profile?.persona ?? "AI teammate"),
      imageUrl: profile?.imageUrl ?? null,
      intelligence: profile?.intelligence ?? null,
      difficulty: profile?.difficulty ?? null,
    };
  });

  return {
    turnsUntilHuman,
    queue,
  };
}

export async function POST(request: Request, context: RouteContext) {
  const actor = await requireActorId(request);
  if ("response" in actor) {
    return actor.response;
  }

  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return jsonError("Invalid game id", {
      status: 400,
      code: "INVALID_GAME_ID",
      details: parsedParams.error.flatten(),
    });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsedBody = bodySchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("Invalid request body", {
      status: 400,
      code: "INVALID_BODY",
      details: parsedBody.error.flatten(),
    });
  }

  const gameResult = await getGameById(parsedParams.data.gameId);
  if ("response" in gameResult) {
    return gameResult.response;
  }
  if (!gameResult.game) {
    return jsonError("Game not found", {
      status: 404,
      code: "GAME_NOT_FOUND",
    });
  }
  const game = gameResult.game;

  const visibility = await canActorReadGame(game, actor.actorId);
  if ("response" in visibility) {
    return visibility.response;
  }
  if (!visibility.canRead) {
    return jsonError("You do not have access to this game", {
      status: 403,
      code: "GAME_FORBIDDEN",
    });
  }

  const [
    movesResult,
    rulesResult,
    levelsResult,
    membersResult,
    storedProfilesResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("woi_template_moves")
      .select("id,order_index,move_text")
      .eq("template_id", game.template_id)
      .order("order_index", { ascending: true }),
    supabaseAdmin
      .from("woi_template_rules")
      .select("id,order_index,rule_text")
      .eq("template_id", game.template_id)
      .order("order_index", { ascending: true }),
    supabaseAdmin
      .from("woi_template_levels")
      .select("id,order_index,level_name,level_objective")
      .eq("template_id", game.template_id)
      .order("order_index", { ascending: true }),
    getTeamMembersOrdered(game.team_id),
    supabaseAdmin
      .from("woi_game_ai_profiles")
      .select("ai_player_count,opponents")
      .eq("game_id", game.id)
      .maybeSingle(),
  ]);

  if (movesResult.error) {
    return jsonDbError("Failed to load template moves", movesResult.error);
  }
  if (rulesResult.error) {
    return jsonDbError("Failed to load template rules", rulesResult.error);
  }
  if (levelsResult.error) {
    return jsonDbError("Failed to load template levels", levelsResult.error);
  }
  if ("response" in membersResult) {
    return membersResult.response;
  }
  if (storedProfilesResult.error && storedProfilesResult.error.code !== "42P01") {
    return jsonDbError("Failed to load stored AI profiles", storedProfilesResult.error);
  }

  const memberUserIds = membersResult.members.map((member) => member.user_id);
  const usersResult = await getUsersByIds(memberUserIds);
  if ("response" in usersResult) {
    return usersResult.response;
  }
  const usersById = mapUsers(usersResult.users);

  const nonHumanMembers = membersResult.members.filter(
    (member) => member.user_id !== actor.actorId,
  );
  const storedProfilesRow = storedProfilesResult.data as
    | { ai_player_count: number | null; opponents: unknown }
    | null;
  const storedOpponentsRaw = Array.isArray(storedProfilesRow?.opponents)
    ? storedProfilesRow?.opponents
    : [];
  const storedOpponents = storedOpponentsRaw
    .map((entry) => {
      const parsed = storedOpponentSchema.safeParse(entry);
      if (!parsed.success) {
        return null;
      }
      return parsed.data;
    })
    .filter((entry): entry is z.infer<typeof storedOpponentSchema> => Boolean(entry));
  const requestedAiPlayerCount = parsedBody.data.aiPlayerCount;
  const maxAiPlayers = nonHumanMembers.length;
  const aiPlayerCount =
    typeof requestedAiPlayerCount === "number"
      ? Math.max(0, Math.min(requestedAiPlayerCount, maxAiPlayers))
      : (typeof storedProfilesRow?.ai_player_count === "number"
        ? Math.max(0, Math.min(storedProfilesRow.ai_player_count, maxAiPlayers))
        : maxAiPlayers);
  const selectedStoredProfiles = storedOpponents.slice(0, aiPlayerCount);
  const storedAiProfiles: AiProfile[] = selectedStoredProfiles.map((profile) => ({
    codename: profile.codename,
    persona: profile.narrative,
    narrative: profile.narrative,
    imageUrl: profile.imageUrl,
    intelligence: profile.intelligence,
    difficulty: profile.difficulty,
  }));
  const missingAiProfiles = Math.max(0, aiPlayerCount - storedAiProfiles.length);
  let rosterSource = storedAiProfiles.length > 0 ? "stored" : "mock";
  let rosterModel = storedAiProfiles.length > 0 ? "stored" : "unknown";
  let generatedAiProfiles: AiProfile[] = [];
  if (missingAiProfiles > 0) {
    const rosterAiResult = await runStructuredAi({
      feature: "template_generation",
      schema: rosterSchema,
      schemaName: "woi_ai_player_roster",
      systemPrompt:
        "You generate concise codename + persona pairs for game AI teammates. Return strict JSON only.",
      userPrompt: [
        `Game question: ${game.question}`,
        `Game description: ${clip(game.description, 500)}`,
        `Generate ${missingAiProfiles} AI teammates.`,
        "Keep codenames short and personas specific.",
      ].join("\n"),
      mockResponse: buildRosterMock(missingAiProfiles),
      createdBy: actor.actorId,
    });

    rosterSource = rosterAiResult.source;
    rosterModel = rosterAiResult.model;
    generatedAiProfiles = rosterAiResult.output.aiPlayers
      .slice(0, missingAiProfiles)
      .map((profile) => ({
        codename: profile.codename,
        persona: profile.persona,
        narrative: profile.persona,
        imageUrl: null,
        intelligence: null,
        difficulty: null,
      }));
  }
  const aiProfiles: AiProfile[] = [...storedAiProfiles, ...generatedAiProfiles];
  while (aiProfiles.length < aiPlayerCount) {
    const fallback = buildRosterMock(aiPlayerCount).aiPlayers[aiProfiles.length];
    if (!fallback) {
      break;
    }
    aiProfiles.push({
      codename: fallback.codename,
      persona: fallback.persona,
      narrative: fallback.persona,
      imageUrl: null,
      intelligence: null,
      difficulty: null,
    });
  }

  const selectedAiMembers = nonHumanMembers.slice(0, aiPlayerCount);
  const selectedAiMemberIds = new Set(selectedAiMembers.map((member) => member.user_id));
  const selectedMembers = membersResult.members.filter(
    (member) => member.user_id === actor.actorId || selectedAiMemberIds.has(member.user_id),
  );

  // Keep tile artwork stable across page loads; regenerate only when client requests it.
  const nonce = parsedBody.data.regenerateNonce ?? `game:${game.id}`;

  const moves = (movesResult.data ?? []) as TemplateMoveRow[];
  const rules = (rulesResult.data ?? []) as TemplateRuleRow[];
  const levels = (levelsResult.data ?? []) as TemplateLevelRow[];

  const moveTiles = await mapWithConcurrency(moves, 2, async (move) => ({
    id: move.id,
    label: move.move_text,
    orderIndex: move.order_index,
    imageUrl: await generateSpinnerImage({
      label: move.move_text,
      question: game.question,
      kind: "move",
      nonce: `${nonce}-move-${move.id}`,
    }),
  }));

  const ruleTiles = await mapWithConcurrency(rules, 2, async (rule) => ({
    id: rule.id,
    label: rule.rule_text,
    orderIndex: rule.order_index,
    imageUrl: await generateSpinnerImage({
      label: rule.rule_text,
      question: game.question,
      kind: "rule",
      nonce: `${nonce}-rule-${rule.id}`,
    }),
  }));

  const levelTiles = await mapWithConcurrency(levels, 2, async (level) => ({
    id: level.id,
    label: level.level_name,
    objective: level.level_objective,
    orderIndex: level.order_index,
    levelIndex: level.order_index - 1,
    imageUrl: await generateSpinnerImage({
      label: level.level_name,
      question: game.question,
      kind: "level",
      nonce: `${nonce}-level-${level.id}`,
    }),
  }));

  const turnForecast = computeTurnForecast({
    members: selectedMembers,
    usersById,
    aiProfiles,
    currentPlayerId: game.current_player_id,
    humanPlayerId: actor.actorId,
  });

  return jsonSuccess(
    {
      gameId: game.id,
      topic: game.question,
      rules: rules.map((rule) => rule.rule_text),
      aiPlayers: turnForecast.queue,
      turnForecast: {
        turnsUntilHuman: turnForecast.turnsUntilHuman,
      },
      spinner: {
        levels: levelTiles,
        moves: moveTiles,
        rules: ruleTiles,
      },
      generatedAt: new Date().toISOString(),
      imageSource: getOpenAIClient() ? "openai" : "fallback",
      rosterSource,
      rosterModel,
    },
    { status: 200 },
  );
}
