import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Only handle /admin routes
  if (!pathname.startsWith("/admin")) return NextResponse.next();

  // Allow open access to new-run (anyone can start)
  if (pathname === "/admin/new-run" || pathname.startsWith("/admin/new-run/")) {
    return NextResponse.next();
  }

  const hasVerisumAdmin = request.cookies.get("ti_verisum_admin")?.value === "1";

  // Gate /admin/run/[runId] via Verisum OR per-run owner cookie
  if (pathname.startsWith("/admin/run/")) {
    const parts = pathname.split("/").filter(Boolean); // ["admin","run",":runId",...]
    const runId = parts[2];

    const ownerCookieName = runId ? `ti_owner_${runId}` : null;
    const hasOwner = ownerCookieName ? request.cookies.get(ownerCookieName)?.value === "1" : false;

    if (hasVerisumAdmin || hasOwner) return NextResponse.next();

    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("auth", "required");
    url.searchParams.set("role", "owner");
    if (runId) url.searchParams.set("runId", runId);
    // Preserve original destination (path + query)
    url.searchParams.set("next", `${pathname}${search || ""}`);
    return NextResponse.redirect(url);
  }

  // Everything else under /admin is Verisum-only
  if (hasVerisumAdmin) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.searchParams.set("auth", "required");
  url.searchParams.set("role", "verisum");
  url.searchParams.set("next", `${pathname}${search || ""}`);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*"],
};
