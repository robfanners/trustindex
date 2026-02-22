import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSupabaseMiddlewareClient } from "@/lib/supabase-auth-middleware";

export async function middleware(request: NextRequest) {
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

  // --- /dashboard/*, /systems/*, /verisum-admin/* protection — requires auth ---
  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/systems") ||
    pathname.startsWith("/verisum-admin")
  ) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      url.searchParams.set("next", `${pathname}${search || ""}`);
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/systems/:path*", "/verisum-admin/:path*"],
};
