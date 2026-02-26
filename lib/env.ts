import "server-only";

import { z } from "zod";

const optionalNonEmptyString = z.preprocess(
  (value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value),
  z.string().min(1).optional(),
);

const optionalPositiveIntegerWithDefault = z.preprocess(
  (value) => {
    if (value === null || value === undefined) {
      return undefined;
    }

    if (typeof value === "string" && value.trim().length === 0) {
      return undefined;
    }

    return value;
  },
  z.coerce.number().int().min(1).max(5000).default(500),
);

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  OPENAI_API_KEY: optionalNonEmptyString,
  DEMO_DEFAULT_USER_ID: optionalNonEmptyString,
  WOI_VIEWER_CAP_PER_GAME: optionalPositiveIntegerWithDefault,
});

export const env = envSchema.parse(process.env);

export type Env = typeof env;
