import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabaseServer";

function cookieSecure() {
  return process.env.NODE_ENV === "production";
}

async function validateAndSetCookie(runId: string, token: string) {
  const { data, error } = await supabaseServer()
    .from("run_admin_tokens")
    .select("run_id,token")
    .eq("run_id", runId)
    .eq("token", token)
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.length === 0) {
    throw new Error("Invalid owner token");
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
}

// TODO: ensure run_admin_tokens table exists with run_id/token columns.
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const runId = url.searchParams.get("runId");
    const ownerToken = url.searchParams.get("ownerToken");
    const next = url.searchParams.get("next") || `/admin/run/${runId}`;

    if (!runId || !ownerToken) {
      return NextResponse.redirect(new URL("/?auth=required&role=owner&runId=" + (runId || ""), req.url), 302);
    }

    await validateAndSetCookie(runId, ownerToken);

    return NextResponse.redirect(new URL(next, req.url), 302);
  } catch (e: any) {
    const url = new URL(req.url);
    const runId = url.searchParams.get("runId") || "";
    return NextResponse.redirect(new URL(`/?auth=required&role=owner&runId=${runId}`, req.url), 302);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const runId = String(body?.runId || "");
    const token = String(body?.token || "");

    if (!runId || !token) {
      return NextResponse.json({ ok: false, error: "Missing runId or token" }, { status: 400 });
    }

    await validateAndSetCookie(runId, token);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
}
