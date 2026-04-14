// ---------------------------------------------------------------------------
// Shared URL utilities — safe origin resolution and redirect validation
// ---------------------------------------------------------------------------

/**
 * Server-side origin resolution for API routes.
 *
 * Priority:
 *   1. Request Origin header (set by browsers on same-origin fetches)
 *   2. Request Host header (always present in HTTP/1.1+), reconstructed with protocol
 *   3. NEXT_PUBLIC_SITE_URL env var
 *   4. Throw — never fall back to localhost
 */
export function getServerOrigin(req: Request): string {
  const origin = req.headers.get("origin");
  if (origin) return origin;

  const host = req.headers.get("host");
  if (host) {
    const proto =
      req.headers.get("x-forwarded-proto") ||
      (host.startsWith("localhost") || host.startsWith("127.0.0.1")
        ? "http"
        : "https");
    return `${proto}://${host}`;
  }

  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl) return envUrl.replace(/\/+$/, "");

  throw new Error(
    "Cannot determine site origin: no Origin header, no Host header, " +
      "and NEXT_PUBLIC_SITE_URL is not set. " +
      "Set NEXT_PUBLIC_SITE_URL in your environment variables."
  );
}

/**
 * Client-side origin resolution for browser components.
 *
 * Priority:
 *   1. window.location.origin (runtime truth — always correct in browser)
 *   2. NEXT_PUBLIC_SITE_URL (build-time fallback, used during SSR/prerender)
 *   3. Empty string (produces relative URLs — safe)
 */
export function getClientOrigin(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "";
}

/**
 * Validate a `next` redirect parameter to prevent open redirects.
 *
 * Allows only relative paths starting with a single `/` that point at a
 * navigable page. Rejects:
 *   - absolute / protocol-relative URLs ("//evil.com", "https://evil.com")
 *   - empty / null
 *   - /api/*  (API routes are typically POST-only — a GET from the auth
 *             callback would 405. See TG-54.)
 *   - /auth/* (would loop the user back to the login flow)
 */
export function safeRedirectPath(
  next: string | null | undefined,
  fallback: string = "/dashboard"
): string {
  if (!next) return fallback;
  if (!/^\/(?:[^/]|$)/.test(next)) return fallback;
  if (next === "/api" || next.startsWith("/api/")) return fallback;
  if (next === "/auth" || next.startsWith("/auth/")) return fallback;
  return next;
}
