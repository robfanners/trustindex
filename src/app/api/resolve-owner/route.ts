import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getRunAdminTokensColumnNames } from "@/lib/runAdminTokensSchema";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = String(body?.token || "");
    if (!token) return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });

    const { runIdCol, tokenCol } = await getRunAdminTokensColumnNames();
    const supabase = supabaseServer();
    const { data, error } = await supabase
      .from("run_admin_tokens")
      .select(runIdCol)
      .eq(tokenCol, token)
      .limit(1);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!data || data.length === 0) {
      return NextResponse.json({ ok: false, error: "Token not found" }, { status: 404 });
    }

const row = data?.[0] as unknown as Record<string, any> | undefined;

if (!row || typeof row[runIdCol] !== "string") {
  throw new Error("Invalid admin token record");
}

const runId = row[runIdCol] as string;
    return NextResponse.json({ ok: true, runId });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
}
