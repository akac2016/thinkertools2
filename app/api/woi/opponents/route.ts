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
    "mechanical gauntlet",
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

  const prompt = [
    "Animated-style full-body character portrait for a social deduction board game.",
    "Visual inspiration: modern tabletop art style similar to Codenames and Avalon (style only, no logos).",
    "2D boardgame character card illustration with bold, expressive design.",
    "Crisp edges, graphic shapes, medium detail, and strong contrast lighting.",
    "Stylized painterly finish, readable at small size, with richer color accents.",
    "Simple atmosphere background, no text, no logos.",
    "Not photorealistic, not anime, not 3D render.",
    "Allow a wide emotional range: playful, cunning, mysterious, intense, or dramatic.",
    "Character must be fully visible in frame from head to toe, not cropped.",
    "Include exactly one clear prop associated with the character.",
    "Prop must be visible and fully in frame.",
    "Ensure this character is visually distinct with unique silhouette, costume, and pose.",
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
  ].join(" ");

  const tryGenerate = async (args: Record<string, unknown>) => {
    const response = await client.images.generate(args as never);
    const url = response.data?.[0]?.url;
    if (url) {
      return url;
    }

    const b64 = response.data?.[0]?.b64_json;
    if (b64) {
      return `data:image/png;base64,${b64}`;
    }

    return null;
  };

  try {
    const gptImage = await tryGenerate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
    });
    if (gptImage) {
      return gptImage;
    }

    const dalle3 = await tryGenerate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      response_format: "url",
    });
    if (dalle3) {
      return dalle3;
    }

    const dalle2 = await tryGenerate({
      model: "dall-e-2",
      prompt,
      n: 1,
      size: "512x512",
      response_format: "url",
    });
    if (dalle2) {
      return dalle2;
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
  const actor = requireActorId(request);
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
      "Narrative must be one paragraph with exactly 2-3 short sentences and no line breaks.",
      "Keep each sentence concise, simple, fun, and easy to read.",
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
  const opponentsWithImages = await Promise.all(
    opponents.map(async (opponent, index) => ({
      ...opponent,
      imageUrl: await generateOpponentPortrait({
        codename: opponent.codename,
        narrative: opponent.narrative,
        intelligence: opponent.intelligence,
        difficulty: opponent.difficulty,
        topic,
        nonce: `${nonce}-${index + 1}`,
      }),
    })),
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
