import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabaseServer";

function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto}://${host}`;
}

function safeNextPath(runId: string, next?: string | null): string {
  if (!next || !next.startsWith("/")) {
    return `/admin/run/${runId}`;
  }
  // Prevent open redirects
  if (next.startsWith("http") || next.includes("://")) {
    return `/admin/run/${runId}`;
  }
  return next;
}

async function validateAndSetCookie(runId: string, token: string, isHttps: boolean) {
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
    secure: isHttps,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

// TODO: ensure run_admin_tokens table exists with run_id/token columns.
export async function GET(req: NextRequest) {
  try {
    const requestUrl = new URL(req.url);
    const runId = requestUrl.searchParams.get("runId");
    const ownerToken = requestUrl.searchParams.get("ownerToken");
    const next = requestUrl.searchParams.get("next");
    const nextPath = safeNextPath(runId || "", next);
    const baseUrl = getBaseUrl(req);
    const isHttps = baseUrl.startsWith("https://");

    if (!runId || !ownerToken) {
      const redirectUrl = new URL(`/?auth=required&role=owner&runId=${runId || ""}`, baseUrl);
      return NextResponse.redirect(redirectUrl, 302);
    }

    await validateAndSetCookie(runId, ownerToken, isHttps);

    const redirectUrl = new URL(nextPath, baseUrl);
    return NextResponse.redirect(redirectUrl, 302);
  } catch (e: any) {
    const requestUrl = new URL(req.url);
    const runId = requestUrl.searchParams.get("runId") || "";
    const baseUrl = getBaseUrl(req);
    const redirectUrl = new URL(`/?auth=required&role=owner&runId=${runId}`, baseUrl);
    return NextResponse.redirect(redirectUrl, 302);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const runId = String(body?.runId || "");
    const token = String(body?.token || "");

    if (!runId || !token) {
      return NextResponse.json({ ok: false, error: "Missing runId or token" }, { status: 400 });
    }

    const baseUrl = getBaseUrl(req);
    const isHttps = baseUrl.startsWith("https://");
    await validateAndSetCookie(runId, token, isHttps);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
}
