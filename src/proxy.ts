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
    "/_next",
    "/favicon.ico",
  ];

  const isPublicPath = publicPaths.some(
    (publicPath) => pathname === publicPath || pathname.startsWith(publicPath + "/")
  );

  const isStaticFile =
    pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|ico|webp|woff|woff2|ttf|eot)$/);

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
     * - api/webhooks (webhooks, auth, etc.)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api/webhooks|_next/static|_next/image|favicon.ico).*)",
  ],
};
