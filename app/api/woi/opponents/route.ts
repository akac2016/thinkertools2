import "server-only";

import OpenAI from "openai";
import { z } from "zod";

import { runStructuredAi } from "@/lib/ai/client";
import { env } from "@/lib/env";
import { jsonError, jsonSuccess } from "@/lib/http";
import { requireActorId } from "@/lib/woi";

function countSentences(value: string) {
  const matches = value.match(/[^.!?]+[.!?]+/g);
  if (!matches) {
    return 0;
  }

  return matches.map((entry) => entry.trim()).filter(Boolean).length;
}

function getSentences(value: string) {
  const matches = value.match(/[^.!?]+[.!?]+/g);
  if (!matches) {
    return [] as string[];
  }

  return matches.map((entry) => entry.trim()).filter(Boolean);
}

function countWords(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

const requestSchema = z
  .object({
    count: z.number().int().min(0).max(4),
    prompt: z.preprocess(
      (value) => (typeof value === "string" ? value.trim() : undefined),
      z.string().min(1).max(500).optional(),
    ),
    regenerateNonce: z.preprocess(
      (value) => (typeof value === "string" ? value.trim() : undefined),
      z.string().min(1).max(120).optional(),
    ),
    usedAppearance: z
      .object({
        skinToneBuckets: z.array(z.string().trim().min(1).max(60)).max(12).optional(),
        featureProfiles: z.array(z.string().trim().min(1).max(60)).max(12).optional(),
        hairProfiles: z.array(z.string().trim().min(1).max(60)).max(12).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const opponentsSchema = z
  .object({
    opponents: z
      .array(
        z
          .object({
            codename: z.string().trim().min(1).max(48),
            narrative: z
              .string()
              .trim()
              .min(40)
              .max(220)
              .refine((value) => !/[\r\n]/.test(value), "narrative must be a single paragraph")
              .refine(
                (value) => {
                  const sentences = countSentences(value);
                  return sentences >= 2 && sentences <= 3;
                },
                "narrative must be 2-3 sentences",
              )
              .refine(
                (value) => getSentences(value).every((sentence) => countWords(sentence) <= 16),
                "each sentence must be short",
              ),
            intelligence: z.enum(["novice", "analytical", "strategic", "expert"]),
            difficulty: z.enum(["easy", "medium", "hard", "adaptive"]),
          })
          .strict(),
      )
      .max(4),
  })
  .strict();

type OpponentSpec = z.infer<typeof opponentsSchema>["opponents"][number];
type AppearanceAxisOption = {
  id: string;
  prompt: string;
};

const FALLBACK_OPPONENTS: OpponentSpec[] = [
  {
    codename: "Signal Scout",
    narrative:
      "Signal Scout spots weak assumptions fast and asks sharp, simple questions. They test ideas quickly and turn good clues into practical next moves.",
    intelligence: "analytical",
    difficulty: "medium",
  },
  {
    codename: "Devil Finch",
    narrative:
      "Devil Finch loves mind games and catches fuzzy logic in seconds. They force cleaner arguments and punish sloppy claims with clever counters.",
    intelligence: "strategic",
    difficulty: "hard",
  },
  {
    codename: "Soft Hammer",
    narrative:
      "Soft Hammer stays calm but controls the table with clear structure. They trim distractions, align the team, and close rounds with confidence.",
    intelligence: "expert",
    difficulty: "adaptive",
  },
  {
    codename: "Steady Orbit",
    narrative:
      "Steady Orbit reads chaos well and keeps everyone focused on the goal. They build steady momentum and make hard decisions feel manageable.",
    intelligence: "novice",
    difficulty: "easy",
  },
];

const SKIN_TONE_BUCKET_OPTIONS: AppearanceAxisOption[] = [
  { id: "very-light", prompt: "very light skin tone with cool or neutral undertones" },
  { id: "light", prompt: "light skin tone with warm or peach undertones" },
  { id: "light-medium", prompt: "light-medium skin tone with golden undertones" },
  { id: "medium", prompt: "medium skin tone with balanced undertones" },
  { id: "tan-olive", prompt: "tan to olive skin tone with warm undertones" },
  { id: "medium-deep", prompt: "medium-deep skin tone with rich warm undertones" },
  { id: "deep", prompt: "deep brown skin tone with warm undertones" },
  { id: "very-deep", prompt: "very deep skin tone with cool or warm undertones" },
];

const FEATURE_PROFILE_OPTIONS: AppearanceAxisOption[] = [
  { id: "monolid-straight-brow", prompt: "monolid eye shape with straight brows and balanced facial proportions" },
  { id: "almond-soft-brow", prompt: "almond-shaped eyes, soft brows, and subtle cheek definition" },
  { id: "deep-set-defined-brow", prompt: "deep-set eyes, defined brows, and angular facial structure" },
  { id: "round-eyes-soft-jaw", prompt: "round eyes, fuller cheeks, and a soft jawline" },
  { id: "high-cheekbones-angular-jaw", prompt: "high cheekbones with a defined angular jawline" },
  { id: "broad-bridge-balanced-jaw", prompt: "broader nose bridge, balanced lips, and medium jaw definition" },
  { id: "narrow-bridge-soft-chin", prompt: "narrow nose bridge, smooth cheeks, and a soft chin profile" },
  { id: "wide-smile-strong-cheeks", prompt: "wider smile line, strong cheek contour, and rounded chin" },
];

const HAIR_PROFILE_OPTIONS: AppearanceAxisOption[] = [
  { id: "black-coily-cropped", prompt: "black tightly coiled cropped hair" },
  { id: "dark-brown-wavy", prompt: "dark brown wavy medium-length hair" },
  { id: "black-straight-long", prompt: "straight black long hair" },
  { id: "auburn-curly", prompt: "auburn curly shoulder-length hair" },
  { id: "blond-textured-short", prompt: "blond short textured hair" },
  { id: "silver-gray-slick", prompt: "silver-gray slicked-back hair" },
  { id: "shaved-head", prompt: "shaved head with no visible hair length" },
  { id: "bald", prompt: "bald head with clean scalp and no visible hair" },
];

function buildMockOpponents(count: number): z.infer<typeof opponentsSchema> {
  return opponentsSchema.parse({
    opponents: Array.from({ length: count }, (_, index) => FALLBACK_OPPONENTS[index % FALLBACK_OPPONENTS.length]),
  });
}

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

function clip(text: string, max: number) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, max - 1))}...`;
}

function hashString(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function createSeededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleOptions(
  options: AppearanceAxisOption[],
  random: () => number,
): AppearanceAxisOption[] {
  const output = [...options];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = output[index];
    output[index] = output[swapIndex] as AppearanceAxisOption;
    output[swapIndex] = current as AppearanceAxisOption;
  }
  return output;
}

function normalizeUsedIds(
  values: string[] | undefined,
  options: AppearanceAxisOption[],
): string[] {
  const allowedIds = new Set(options.map((option) => option.id));
  const unique = new Set<string>();
  for (const value of values ?? []) {
    const normalized = value.trim();
    if (!normalized || !allowedIds.has(normalized)) {
      continue;
    }
    unique.add(normalized);
  }
  return Array.from(unique);
}

function pickWeightedOption(
  options: AppearanceAxisOption[],
  usedIds: Set<string>,
  random: () => number,
  unusedBoost = 1.5,
): AppearanceAxisOption {
  const weighted = options.map((option) => ({
    option,
    weight: usedIds.has(option.id) ? 1 : unusedBoost,
  }));
  const totalWeight = weighted.reduce((total, item) => total + item.weight, 0);
  if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
    return options[0] as AppearanceAxisOption;
  }

  let threshold = random() * totalWeight;
  for (const item of weighted) {
    threshold -= item.weight;
    if (threshold <= 0) {
      return item.option;
    }
  }

  return weighted[weighted.length - 1]?.option ?? (options[0] as AppearanceAxisOption);
}

function buildAxisPlan(input: {
  options: AppearanceAxisOption[];
  count: number;
  usedIds: string[];
  seed: string;
}): AppearanceAxisOption[] {
  const random = createSeededRandom(hashString(input.seed));
  if (input.count <= 0) {
    return [];
  }

  if (input.usedIds.length === 0 && input.count <= input.options.length) {
    return shuffleOptions(input.options, random).slice(0, input.count);
  }

  const seenIds = new Set(input.usedIds);
  const plan: AppearanceAxisOption[] = [];
  for (let index = 0; index < input.count; index += 1) {
    const picked = pickWeightedOption(input.options, seenIds, random, 1.5);
    plan.push(picked);
    seenIds.add(picked.id);
  }

  return plan;
}

type AppearancePlanEntry = {
  skinTone: AppearanceAxisOption;
  feature: AppearanceAxisOption;
  hair: AppearanceAxisOption;
};

function buildAppearancePlan(input: {
  count: number;
  topic: string;
  nonce: string;
  usedAppearance?: {
    skinToneBuckets?: string[];
    featureProfiles?: string[];
    hairProfiles?: string[];
  };
}): AppearancePlanEntry[] {
  const count = Math.max(0, Math.floor(input.count));
  if (count === 0) {
    return [];
  }

  const baseSeed = `${input.topic}:${input.nonce}:${count}`;
  const skinPlan = buildAxisPlan({
    options: SKIN_TONE_BUCKET_OPTIONS,
    count,
    usedIds: normalizeUsedIds(
      input.usedAppearance?.skinToneBuckets,
      SKIN_TONE_BUCKET_OPTIONS,
    ),
    seed: `${baseSeed}:skin`,
  });
  const featurePlan = buildAxisPlan({
    options: FEATURE_PROFILE_OPTIONS,
    count,
    usedIds: normalizeUsedIds(
      input.usedAppearance?.featureProfiles,
      FEATURE_PROFILE_OPTIONS,
    ),
    seed: `${baseSeed}:feature`,
  });
  const hairPlan = buildAxisPlan({
    options: HAIR_PROFILE_OPTIONS,
    count,
    usedIds: normalizeUsedIds(input.usedAppearance?.hairProfiles, HAIR_PROFILE_OPTIONS),
    seed: `${baseSeed}:hair`,
  });

  const defaultSkin = SKIN_TONE_BUCKET_OPTIONS[0] as AppearanceAxisOption;
  const defaultFeature = FEATURE_PROFILE_OPTIONS[0] as AppearanceAxisOption;
  const defaultHair = HAIR_PROFILE_OPTIONS[0] as AppearanceAxisOption;

  return Array.from({ length: count }, (_, index) => ({
    skinTone: skinPlan[index] ?? defaultSkin,
    feature: featurePlan[index] ?? defaultFeature,
    hair: hairPlan[index] ?? defaultHair,
  }));
}

function fallbackPortraitDataUrl(codename: string, difficulty: string) {
  const seed = hashString(`${codename}:${difficulty}`);
  const hueShift = seed % 80;
  const hue =
    difficulty === "easy"
      ? 140 + (hueShift % 30)
      : difficulty === "medium"
        ? 200 + (hueShift % 30)
        : difficulty === "hard"
          ? 10 + (hueShift % 25)
          : 260 + (hueShift % 45);
  const variant = seed % 4;
  const propVariant = Math.floor(seed / 7) % 5;
  const title = clip(codename, 18).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const body =
    variant === 0
      ? `<circle cx="256" cy="170" r="72" fill="rgba(255,255,255,0.3)"/>
         <rect x="184" y="238" width="144" height="148" rx="32" fill="rgba(255,255,255,0.24)"/>`
      : variant === 1
        ? `<circle cx="244" cy="170" r="68" fill="rgba(255,255,255,0.3)"/>
           <path d="M165 390 L200 240 L300 240 L345 390 Z" fill="rgba(255,255,255,0.24)"/>`
        : variant === 2
          ? `<circle cx="268" cy="165" r="70" fill="rgba(255,255,255,0.3)"/>
             <rect x="178" y="240" width="160" height="154" rx="64" fill="rgba(255,255,255,0.24)"/>`
          : `<circle cx="256" cy="166" r="66" fill="rgba(255,255,255,0.3)"/>
             <path d="M172 390 C176 280 210 230 256 230 C302 230 336 280 340 390 Z" fill="rgba(255,255,255,0.24)"/>`;
  const prop =
    propVariant === 0
      ? `<rect x="328" y="250" width="24" height="120" rx="12" fill="rgba(255,255,255,0.55)"/>
         <circle cx="340" cy="230" r="26" fill="rgba(255,255,255,0.65)"/>`
      : propVariant === 1
        ? `<rect x="130" y="260" width="22" height="132" rx="11" fill="rgba(255,255,255,0.55)"/>
           <polygon points="110,260 172,260 141,205" fill="rgba(255,255,255,0.65)"/>`
        : propVariant === 2
          ? `<circle cx="360" cy="282" r="22" stroke="rgba(255,255,255,0.7)" stroke-width="10" fill="none"/>
             <line x1="375" y1="296" x2="406" y2="326" stroke="rgba(255,255,255,0.7)" stroke-width="10" stroke-linecap="round"/>`
          : propVariant === 3
            ? `<rect x="120" y="274" width="56" height="76" rx="8" fill="rgba(255,255,255,0.62)"/>
               <line x1="130" y1="296" x2="166" y2="296" stroke="rgba(255,255,255,0.88)" stroke-width="3"/>`
            : `<path d="M342 240 C360 220 392 220 410 240 C392 260 360 260 342 240 Z" fill="rgba(255,255,255,0.66)"/>
               <rect x="370" y="238" width="12" height="124" rx="6" fill="rgba(255,255,255,0.55)"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue} 85% 60%)"/>
      <stop offset="100%" stop-color="hsl(${(hue + 55) % 360} 80% 42%)"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="512" height="512" rx="48" fill="url(#g)"/>
  ${body}
  ${prop}
  <text x="256" y="382" text-anchor="middle" fill="white" font-size="28" font-family="Arial, Helvetica, sans-serif" font-weight="700">${title}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

async function generateOpponentPortrait(input: {
  codename: string;
  narrative: string;
  intelligence: OpponentSpec["intelligence"];
  difficulty: OpponentSpec["difficulty"];
  topic: string;
  nonce: string;
  skinToneDirection: string;
  featureDirection: string;
  hairDirection: string;
}) {
  const client = getOpenAIClient();
  if (!client) {
    return fallbackPortraitDataUrl(input.codename, input.difficulty);
  }

  const designSeed = hashString(
    `${input.codename}:${input.intelligence}:${input.difficulty}:${input.nonce}`,
  );
  const propOptions = [
    "spyglass",
    "crystal key",
    "engraved rapier",
    "tactical map scroll",
    "lantern compass",
    "arcane tome",
    "signal whistle",
  ];
  const poseOptions = [
    "three-quarter heroic pose",
    "forward-leaning strategist pose",
    "confident stance with one hand on prop",
    "dynamic mid-gesture debate pose",
    "calm upright posture with strong silhouette",
  ];
  const paletteOptions = [
    "teal, copper, and cream",
    "crimson, slate, and gold",
    "indigo, cyan, and warm gray",
    "emerald, charcoal, and amber",
    "cobalt, coral, and sand",
  ];
  const silhouetteOptions = [
    "long coat and angular shoulders",
    "layered cape with compact silhouette",
    "tailored vest with broad stance",
    "sleek tunic with asymmetrical accessories",
    "structured jacket with bold geometric trim",
  ];
  const prop = propOptions[designSeed % propOptions.length] ?? "lantern compass";
  const pose = poseOptions[Math.floor(designSeed / 7) % poseOptions.length] ?? "heroic pose";
  const palette =
    paletteOptions[Math.floor(designSeed / 11) % paletteOptions.length] ?? "teal and copper";
  const silhouette =
    silhouetteOptions[Math.floor(designSeed / 13) % silhouetteOptions.length] ??
    "structured costume";
  const basePromptParts = [
    "Animated-style full-body character portrait for a social deduction board game.",
    "Visual inspiration: modern tabletop art style similar to Codenames and Avalon (style only, no logos).",
    "2D boardgame character card illustration with bold, expressive design.",
    "Crisp edges, graphic shapes, medium detail, and strong contrast lighting.",
    "Stylized painterly finish, readable at small size, with richer color accents.",
    "Simple atmosphere background, no text, no logos.",
    "Not photorealistic, not anime, not 3D render.",
    "Allow a wide emotional range: playful, cunning, mysterious, intense, or dramatic.",
    "Prefer a gender-neutral or androgynous presentation unless explicit gender is provided.",
    "Character must be fully visible in frame from head to toe, not cropped.",
    "Keep at least 10% top padding above the head and 5% side padding around the body.",
    "Do not let the head, hair, hands, or feet touch the image boundary.",
    "Use a slightly zoomed-out camera so the full silhouette fits comfortably.",
    "Include exactly one clear prop associated with the character.",
    "Prop must be visible and fully in frame.",
    "Ensure this character is visually distinct with unique silhouette, costume, and pose.",
    "Across the full opponent roster, vary ethnicity-coded visual traits and skin tones.",
    "Avoid stereotypes or caricatures.",
    `Use this silhouette direction: ${silhouette}.`,
    `Use this pose direction: ${pose}.`,
    `Use this prop: ${prop}.`,
    `Use this palette direction: ${palette}.`,
    "No text, no letters, no watermark, no UI.",
    `Character codename: ${input.codename}.`,
    `Intelligence profile: ${input.intelligence}.`,
    `Difficulty profile: ${input.difficulty}.`,
    `Character narrative: ${clip(input.narrative, 280)}.`,
    `Game topic: ${clip(input.topic, 160)}.`,
    `Variation seed: ${input.nonce}.`,
  ];
  const primaryPrompt = [
    ...basePromptParts,
    `Use this skin tone direction: ${input.skinToneDirection}.`,
    `Use this facial-feature direction: ${input.featureDirection}.`,
    `Use this hair direction: ${input.hairDirection}.`,
  ].join(" ");
  const compatibilityPrompt = [
    ...basePromptParts,
    `Use this skin tone direction: ${input.skinToneDirection}.`,
    `Use this hair direction: ${input.hairDirection}.`,
  ].join(" ");
  const minimalPrompt = basePromptParts.join(" ");

  const tryGenerate = async (args: Record<string, unknown>) => {
    try {
      const response = await client.images.generate(args as never);
      const url = response.data?.[0]?.url;
      if (url) {
        return url;
      }

      const b64 = response.data?.[0]?.b64_json;
      if (b64) {
        return `data:image/png;base64,${b64}`;
      }
    } catch {
      return null;
    }

    return null;
  };

  const tryModelsForPrompt = async (prompt: string) => {
    for (const size of ["1024x1536", "1024x1024"] as const) {
      const gptImage = await tryGenerate({
        model: "gpt-image-1",
        prompt,
        size,
      });
      if (gptImage) {
        return gptImage as string;
      }
    }

    for (const size of ["1024x1792", "1024x1024"] as const) {
      const dalle3 = await tryGenerate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size,
        response_format: "url",
      });
      if (dalle3) {
        return dalle3 as string;
      }
    }

    for (const size of ["1024x1024", "512x512"] as const) {
      const dalle2 = await tryGenerate({
        model: "dall-e-2",
        prompt,
        n: 1,
        size,
        response_format: "url",
      });
      if (dalle2) {
        return dalle2 as string;
      }
    }

    return null;
  };

  try {
    const primary = await tryModelsForPrompt(primaryPrompt);
    if (primary) {
      return primary;
    }

    const compatibility = await tryModelsForPrompt(compatibilityPrompt);
    if (compatibility) {
      return compatibility;
    }

    const minimal = await tryModelsForPrompt(minimalPrompt);
    if (minimal) {
      return minimal;
    }
  } catch (error) {
    console.error("Failed to generate opponent portrait", {
      codename: input.codename,
      error,
    });
  }

  return fallbackPortraitDataUrl(input.codename, input.difficulty);
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

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid request body", {
      status: 400,
      code: "INVALID_BODY",
      details: parsed.error.flatten(),
    });
  }

  const count = parsed.data.count;
  if (count === 0) {
    return jsonSuccess({ opponents: [] });
  }

  const topic = parsed.data.prompt?.trim() || "general strategy and reasoning";
  const nonce = parsed.data.regenerateNonce?.trim() || "default";

  const aiResult = await runStructuredAi({
    feature: "template_generation",
    schema: opponentsSchema,
    schemaName: "woi_ai_opponents",
    systemPrompt:
      "Generate AI game opponents for a collaborative inquiry game. Return strict JSON only.",
    userPrompt: [
      `Generate exactly ${count} opponents.`,
      `Topic focus: ${topic}`,
      `Shuffle seed: ${nonce}`,
      "Each opponent needs: codename, narrative, intelligence, difficulty.",
      "Use codename formats that avoid real first names and avoid gender-coded naming.",
      "Narrative must be one paragraph with exactly 2-3 short sentences and no line breaks.",
      "Keep each sentence concise, simple, fun, and easy to read.",
      "Use gender-neutral phrasing in narrative; avoid he/him and she/her pronouns.",
      "Make personalities distinct and fun, with varied challenge levels.",
    ].join("\n"),
    mockResponse: buildMockOpponents(count),
    createdBy: actor.actorId,
  });

  const opponents = aiResult.output.opponents.slice(0, count);
  while (opponents.length < count) {
    opponents.push(
      FALLBACK_OPPONENTS[opponents.length % FALLBACK_OPPONENTS.length] as OpponentSpec,
    );
  }
  const appearancePlan = buildAppearancePlan({
    count,
    topic,
    nonce,
    usedAppearance: parsed.data.usedAppearance,
  });
  const opponentsWithImages = await Promise.all(
    opponents.map(async (opponent, index) => {
      const appearance = appearancePlan[index] ?? {
        skinTone: SKIN_TONE_BUCKET_OPTIONS[0] as AppearanceAxisOption,
        feature: FEATURE_PROFILE_OPTIONS[0] as AppearanceAxisOption,
        hair: HAIR_PROFILE_OPTIONS[0] as AppearanceAxisOption,
      };
      return {
        ...opponent,
        imageUrl: await generateOpponentPortrait({
          codename: opponent.codename,
          narrative: opponent.narrative,
          intelligence: opponent.intelligence,
          difficulty: opponent.difficulty,
          topic,
          nonce: `${nonce}-${index + 1}`,
          skinToneDirection: appearance.skinTone.prompt,
          featureDirection: appearance.feature.prompt,
          hairDirection: appearance.hair.prompt,
        }),
        appearance: {
          skinToneBucket: appearance.skinTone.id,
          featureProfile: appearance.feature.id,
          hairProfile: appearance.hair.id,
        },
      };
    }),
  );

  return jsonSuccess({
    opponents: opponentsWithImages,
    ai: {
      source: aiResult.source,
      model: aiResult.model,
      status: aiResult.status,
    },
  });
}
