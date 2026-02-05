import "server-only";

import { createClient, type PostgrestError } from "@supabase/supabase-js";

import { jsonSuccess } from "@/lib/http";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

type ProbeClient = "anon" | "service-role";
type ProbeExpectation = "allow" | "deny-or-empty" | "contextual";

type TableProbeConfig = {
  table: "woi_games" | "quipx_sessions" | "comments";
  expectationByClient: Record<ProbeClient, ProbeExpectation>;
};

type ProbeActual = {
  result: "rows" | "empty" | "error";
  rowCount: number | null;
  errorCode: string | null;
  errorMessage: string | null;
};

type ProbeRow = {
  table: TableProbeConfig["table"];
  client: ProbeClient;
  expected: {
    rule: ProbeExpectation;
    label: string;
  };
  actual: ProbeActual;
  pass: boolean;
  note?: string;
};

const TABLE_PROBES: TableProbeConfig[] = [
  {
    table: "woi_games",
    expectationByClient: {
      anon: "allow",
      "service-role": "allow",
    },
  },
  {
    table: "quipx_sessions",
    expectationByClient: {
      anon: "deny-or-empty",
      "service-role": "allow",
    },
  },
  {
    table: "comments",
    expectationByClient: {
      anon: "contextual",
      "service-role": "allow",
    },
  },
];

const EXPECTATION_LABEL: Record<ProbeExpectation, string> = {
  allow: "Readable",
  "deny-or-empty": "Denied or empty",
  contextual: "Context policy (verify)",
};

function probeActualFromResponse(count: number | null, error: PostgrestError | null): ProbeActual {
  if (error) {
    return {
      result: "error",
      rowCount: null,
      errorCode: error.code ?? null,
      errorMessage: error.message,
    };
  }

  return {
    result: (count ?? 0) > 0 ? "rows" : "empty",
    rowCount: count ?? 0,
    errorCode: null,
    errorMessage: null,
  };
}

function evaluatePass(expectation: ProbeExpectation, actual: ProbeActual): boolean {
  if (expectation === "allow") {
    return actual.result !== "error";
  }

  if (expectation === "deny-or-empty") {
    return actual.result === "error" || actual.result === "empty";
  }

  return true;
}

function contextualNote(actual: ProbeActual): string {
  if (actual.result === "rows") {
    return "Rows visible with current anon context.";
  }

  if (actual.result === "empty") {
    return "No visible rows for anon context.";
  }

  return "Access denied for anon context.";
}

async function runReadCheck(
  client: ProbeClient,
  table: TableProbeConfig["table"],
): Promise<ProbeActual> {
  const db =
    client === "anon"
      ? createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        })
      : supabaseAdmin;

  const { count, error } = await db
    .from(table)
    .select("*", { head: true, count: "exact" })
    .limit(1);

  return probeActualFromResponse(count, error);
}

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  const rows: ProbeRow[] = [];

  for (const tableProbe of TABLE_PROBES) {
    for (const client of ["anon", "service-role"] as const) {
      const expectedRule = tableProbe.expectationByClient[client];
      const actual = await runReadCheck(client, tableProbe.table);
      const isPass = evaluatePass(expectedRule, actual);

      rows.push({
        table: tableProbe.table,
        client,
        expected: {
          rule: expectedRule,
          label: EXPECTATION_LABEL[expectedRule],
        },
        actual,
        pass: isPass,
        ...(expectedRule === "contextual" ? { note: contextualNote(actual) } : {}),
      });
    }
  }

  return jsonSuccess(
    {
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      matrix: rows,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
