import "server-only";

import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

export const supabaseServer = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);
