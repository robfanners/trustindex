import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getRunAdminTokensColumnNames } from "@/lib/runAdminTokensSchema";

/**
 * Diagnostic endpoint: returns whether a runId+token pair exists and which columns are used.
 * Does NOT return sensitive values. For debugging auth-owner / run_admin_tokens schema only.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const runId = url.searchParams.get("runId") ?? "";
    const token = url.searchParams.get("token") ?? "";

    const { runIdCol, tokenCol } = await getRunAdminTokensColumnNames();
    const supabase = supabaseServer();

    const { data, error } = await supabase
      .from("run_admin_tokens")
      .select(runIdCol)
      .eq(runIdCol, runId)
      .eq(tokenCol, token)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { found: false, runIdCol, tokenCol, error: error.message },
        { status: 200 }
      );
    }

    return NextResponse.json({
      found: !!data,
      runIdCol,
      tokenCol,
    });
  } catch (e: any) {
    return NextResponse.json(
      { found: false, runIdCol: "run_id", tokenCol: "token", error: e?.message || "Unknown error" },
      { status: 200 }
    );
  }
}
