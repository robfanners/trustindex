import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

/**
 * Keepalive endpoint to prevent Supabase project pause from inactivity.
 * Run a trivial DB read so Supabase sees activity. Call at least every 5 days
 * (e.g. via Vercel Cron, GitHub Actions, or external cron).
 *
 * Optional: set KEEPALIVE_SECRET in env; then call with ?secret=... or header X-Keepalive-Secret.
 */
export async function GET(req: Request) {
  const secret = process.env.KEEPALIVE_SECRET;
  if (secret) {
    const authHeader = req.headers.get("Authorization");
    const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const provided =
      req.headers.get("X-Keepalive-Secret") ??
      new URL(req.url).searchParams.get("secret") ??
      bearer;
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const supabase = supabaseServer();
    const { error } = await supabase
      .from("organisations")
      .select("id")
      .limit(1);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
