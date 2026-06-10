import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getServerOrigin, safeRedirectPath } from "@/lib/url";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { supabaseServer } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// ensureOrganisationLinked — server-side helper
//
// Every signed-in user must have profiles.organisation_id set, otherwise all
// org-scoped API endpoints return 400 "No organisation linked". The /api/org/
// ensure route used to gate this behind a paid plan, which created a chicken-
// and-egg for free signups: they couldn't progress without an org, but
// couldn't get an org without paying.
//
// This helper runs on every successful magic-link exchange, idempotently
// creates+links an organisation if missing. Uses the service-role admin
// client because organisations has RLS enabled with no public-insert policy.
// ---------------------------------------------------------------------------
async function ensureOrganisationLinked(userId: string, userEmail: string | null) {
  try {
    const admin = supabaseServer();

    const { data: profile } = await admin
      .from("profiles")
      .select("organisation_id, company_name, email")
      .eq("id", userId)
      .maybeSingle();

    if (!profile || profile.organisation_id) {
      return; // No profile yet (trigger may not have fired) or already linked
    }

    const orgName =
      (profile.company_name as string | null)?.trim() ||
      (profile.email ?? userEmail ?? "").split("@")[1]?.split(".")[0] ||
      "My Organisation";

    const { data: org, error: orgErr } = await admin
      .from("organisations")
      .insert({ name: orgName })
      .select("id")
      .single();

    if (orgErr || !org) {
      console.error("[auth/callback] org insert failed:", orgErr);
      return;
    }

    const { error: linkErr } = await admin
      .from("profiles")
      .update({ organisation_id: org.id })
      .eq("id", userId);

    if (linkErr) {
      console.error("[auth/callback] org link failed:", linkErr);
    }
  } catch (e) {
    console.error("[auth/callback] ensureOrganisationLinked failed:", e);
    // Non-fatal: continue with normal redirect
  }
}

// ---------------------------------------------------------------------------
// GET /auth/callback — Server-side PKCE code exchange
//
// Supabase's @supabase/ssr stores the PKCE code verifier in an httpOnly
// cookie. The code exchange MUST happen server-side so we can read that
// cookie. A client-side page.tsx cannot access httpOnly cookies.
//
// IMPORTANT: We use getServerOrigin(request) instead of request.nextUrl.origin
// because behind a reverse proxy (e.g. Hostinger), nextUrl.origin returns
// the internal server address (0.0.0.0:3000) rather than the public domain.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // Rate limiting: 20 requests per minute (auth callbacks from multiple users/devices)
  const ip = getClientIp(request.headers);
  const limit = checkRateLimit(ip, { windowMs: 60_000, maxRequests: 20 });
  if (!limit.allowed) {
    const origin = getServerOrigin(request);
    return NextResponse.redirect(
      new URL("/auth/login?error=rate_limited", origin)
    );
  }
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"));
  const claim = searchParams.get("claim");
  const origin = getServerOrigin(request);

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // setAll can fail in certain contexts — non-fatal
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Ensure the user has an organisation linked. Runs on every successful
      // exchange (idempotent: skips users who already have one).
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await ensureOrganisationLinked(user.id, user.email ?? null);
      }

      // If the Explorer claim flag is set, redirect via the client-side
      // /auth/complete page so it can read localStorage and call the
      // claim API before landing on the dashboard.
      if (claim === "1") {
        const completeUrl = new URL("/auth/complete", origin);
        completeUrl.searchParams.set("next", next);
        completeUrl.searchParams.set("claim", "1");
        return NextResponse.redirect(completeUrl);
      }

      // Normal login — redirect straight to the destination
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  // No code or exchange failed — redirect to login with error
  return NextResponse.redirect(
    new URL("/auth/login?error=auth_failed", origin)
  );
}
