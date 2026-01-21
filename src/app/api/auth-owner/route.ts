import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabaseServer";

function cookieSecure() {
  return process.env.NODE_ENV === "production";
}

// TODO: ensure run_admin_tokens table exists with run_id/token columns.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const runId = String(body?.runId || "");
    const token = String(body?.token || "");

    if (!runId || !token) {
      return NextResponse.json({ ok: false, error: "Missing runId or token" }, { status: 400 });
    }

    const { data, error } = await supabaseServer()
      .from("run_admin_tokens")
      .select("run_id,token")
      .eq("run_id", runId)
      .eq("token", token)
      .limit(1);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ ok: false, error: "Invalid owner token" }, { status: 401 });
    }

    const cookieName = `ti_owner_${runId}`;
    const cookieStore = await cookies();

    cookieStore.set(cookieName, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: cookieSecure(),
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
}
