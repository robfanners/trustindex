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

  // --- /admin route protection ---
  if (pathname.startsWith("/admin")) {
    // Allow open access to new-run (anyone can start)
    if (pathname === "/admin/new-run" || pathname.startsWith("/admin/new-run/")) {
      return response;
    }

    const hasVerisumAdmin = request.cookies.get("ti_verisum_admin")?.value === "1";

    // Gate /admin/run/[runId] via Supabase Auth OR Verisum admin OR per-run owner cookie
    if (pathname.startsWith("/admin/run/")) {
      const parts = pathname.split("/").filter(Boolean);
      const runId = parts[2];

      const ownerCookieName = runId ? `ti_owner_${runId}` : null;
      const hasOwner = ownerCookieName ? request.cookies.get(ownerCookieName)?.value === "1" : false;

      if (user || hasVerisumAdmin || hasOwner) return response;

      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      url.searchParams.set("next", `${pathname}${search || ""}`);
      return NextResponse.redirect(url);
    }

    // Everything else under /admin requires Supabase Auth or Verisum admin
    if (user || hasVerisumAdmin) {
      if (pathname === "/admin") {
        const url = request.nextUrl.clone();
        url.pathname = "/admin/new-run";
        return NextResponse.redirect(url);
      }
      return response;
    }

    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    const nextPath = pathname === "/admin" ? "/admin/new-run" : `${pathname}${search || ""}`;
    url.searchParams.set("next", nextPath);
    return NextResponse.redirect(url);
  }

  // --- /dashboard (exact) protection — requires auth ---
  if (pathname === "/dashboard") {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      url.searchParams.set("next", "/dashboard");
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*"],
};
