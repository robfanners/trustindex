import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

// TODO: ensure run_admin_tokens table exists with run_id/token columns.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = String(body?.token || "");
    if (!token) return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });

    const { data, error } = await supabaseServer
      .from("run_admin_tokens")
      .select("run_id")
      .eq("token", token)
      .limit(1);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!data || data.length === 0) {
      return NextResponse.json({ ok: false, error: "Token not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, runId: data[0].run_id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
}
