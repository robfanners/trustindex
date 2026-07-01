import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSupabaseMiddlewareClient } from "@/lib/supabase-auth-middleware";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Create a response we can mutate (for cookie refresh)
  const response = NextResponse.next({ request });

  // Refresh Supabase auth session on every request (keeps cookies fresh)
  const supabase = createSupabaseMiddlewareClient(request, response);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // --- Redirect old /admin routes to new dashboard equivalents ---

  // /admin/new-run → /dashboard/surveys/new
  if (
    pathname === "/admin/new-run" ||
    pathname.startsWith("/admin/new-run/")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard/surveys/new";
    return NextResponse.redirect(url);
  }

  // /admin/run/[runId] → /dashboard/surveys/[runId]
  if (pathname.startsWith("/admin/run/")) {
    const parts = pathname.split("/").filter(Boolean);
    const runId = parts[2];
    if (runId) {
      const url = request.nextUrl.clone();
      url.pathname = `/dashboard/surveys/${runId}`;
      return NextResponse.redirect(url);
    }
  }

  // /admin → /dashboard
  if (pathname === "/admin" || pathname === "/admin/") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // --- Redirect old /dashboard/[runId] → /dashboard/surveys/[runId]/results ---
  // Match /dashboard/UUID but not /dashboard/surveys/* or /dashboard?tab=*
  const oldResultsMatch = pathname.match(
    /^\/dashboard\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
  );
  if (oldResultsMatch) {
    const runId = oldResultsMatch[1];
    const url = request.nextUrl.clone();
    url.pathname = `/dashboard/surveys/${runId}/results`;
    return NextResponse.redirect(url);
  }

  // --- Redirect old /dashboard?tab=systems → /dashboard#trustsys ---
  if (pathname === "/dashboard" && request.nextUrl.searchParams.get("tab") === "systems") {
    const url = request.nextUrl.clone();
    url.searchParams.delete("tab");
    url.hash = "trustsys";
    return NextResponse.redirect(url);
  }

  // --- Auth protection: protect ALL routes by default, whitelist public paths ---
  const publicPaths = [
    "/auth",
    "/api/public",
    "/api/keepalive",
    "/survey",
    "/try",
    "/verify",
    "/api/auth",
    // Anonymous Explorer flow: /try fires POST /api/try-explorer before the
    // user has a session. Must be whitelisted or the middleware redirects the
    // POST to /auth/login → 405. See TG-54.
    "/api/try-explorer",
    // Stripe sends signed webhook POSTs from its own infrastructure — they have
    // no Supabase session. Must be whitelisted or all webhook deliveries are
    // 307-redirected to /auth/login and the handler never runs. Discovered
    // 2026-06-09 — caused first live £79 charge to not upgrade the user's plan.
    "/api/stripe/webhook",
    "/_next",
    "/favicon.ico",
  ];

  const isPublicPath = publicPaths.some(
    (publicPath) => pathname === publicPath || pathname.startsWith(publicPath + "/")
  );

  const isStaticFile =
    pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|ico|webp|woff|woff2|ttf|eot)$/);

  // --- 2FA enforcement (task #36) ---
  //
  // Two cases handled here, both using JWT-based assurance levels
  // (getAuthenticatorAssuranceLevel — no DB round-trip):
  //
  // Case 1: Session at aal1 but user has MFA enrolled (nextLevel === "aal2")
  //         → redirect to login to complete the MFA challenge. This catches
  //         sessions that started before MFA was enrolled and pages loaded
  //         mid-challenge.
  //
  // Case 2: No MFA enrolled AND user signed up on/after
  //         MFA_ENFORCE_NEW_SIGNUPS_FROM (env var) → redirect to
  //         /auth/setup-mfa. Existing users pre-enforcement bypass this
  //         and can opt in via Settings → Security.
  //
  // If MFA_ENFORCE_NEW_SIGNUPS_FROM is unset, Case 2 is off entirely.
  const enforceFrom = process.env.MFA_ENFORCE_NEW_SIGNUPS_FROM;
  if (
    user &&
    !pathname.startsWith("/auth/") &&
    !isPublicPath &&
    !isStaticFile
  ) {
    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    // Case 1: MFA enrolled, current session hasn't completed challenge
    if (aal && aal.nextLevel === "aal2" && aal.currentLevel === "aal1") {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      url.searchParams.set("next", `${pathname}${search || ""}`);
      return NextResponse.redirect(url);
    }

    // Case 2: No MFA enrolled + enforcement window active
    if (
      aal &&
      aal.nextLevel === "aal1" &&
      enforceFrom &&
      user.created_at
    ) {
      const createdAt = new Date(user.created_at);
      const enforceDate = new Date(enforceFrom);
      if (
        !isNaN(enforceDate.getTime()) &&
        createdAt >= enforceDate
      ) {
        const url = request.nextUrl.clone();
        url.pathname = "/auth/setup-mfa";
        url.searchParams.set("next", `${pathname}${search || ""}`);
        return NextResponse.redirect(url);
      }
    }
  }

  if (!isPublicPath && !isStaticFile && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", `${pathname}${search || ""}`);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/webhooks (any future webhook namespace)
     * - api/stripe/webhook (current Stripe webhook handler — receives signed
     *   POSTs from Stripe with no Supabase session; must skip proxy entirely)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api/webhooks|api/stripe/webhook|_next/static|_next/image|favicon.ico).*)",
  ],
};
