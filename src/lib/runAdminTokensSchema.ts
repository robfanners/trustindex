import { supabaseServer } from "@/lib/supabaseServer";

const RUN_ADMIN_TOKENS_TABLE = "run_admin_tokens";

const PREFERRED_RUN_ID_COLS = ["run_id", "runId"] as const;
const PREFERRED_TOKEN_COLS = ["owner_token", "token", "admin_code", "ownerToken"] as const;

/**
 * Detect column names in public.run_admin_tokens at runtime.
 * Uses information_schema when available; falls back to trying known names.
 */
export async function getRunAdminTokensColumns(): Promise<Set<string>> {
  const supabase = supabaseServer();
  try {
    const { data, error } = await supabase
      .schema("information_schema")
      .from("columns")
      .select("column_name")
      .eq("table_schema", "public")
      .eq("table_name", RUN_ADMIN_TOKENS_TABLE);

    if (error || !data || data.length === 0) {
      return fallbackColumns();
    }
    return new Set(data.map((r: { column_name: string }) => r.column_name));
  } catch {
    return fallbackColumns();
  }
}

/** When information_schema is unavailable, assume standard run_id + token columns. */
function fallbackColumns(): Set<string> {
  return new Set(["run_id", "token"]);
}

export function pickRunIdColumn(columns: Set<string>): string {
  for (const col of PREFERRED_RUN_ID_COLS) {
    if (columns.has(col)) return col;
  }
  return "run_id";
}

export function pickTokenColumn(columns: Set<string>): string {
  for (const col of PREFERRED_TOKEN_COLS) {
    if (columns.has(col)) return col;
  }
  return "token";
}

export async function getRunAdminTokensColumnNames(): Promise<{
  runIdCol: string;
  tokenCol: string;
}> {
  const columns = await getRunAdminTokensColumns();
  return {
    runIdCol: pickRunIdColumn(columns),
    tokenCol: pickTokenColumn(columns),
  };
}
