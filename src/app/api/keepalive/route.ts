import { supabaseServer } from "@/lib/supabase/admin";
import { apiError, apiOk } from "@/lib/apiHelpers";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

/**
 * Keepalive endpoint to prevent Supabase project pause from inactivity.
 * Run a trivial DB read so Supabase sees activity. Call at least every 5 days
 * (e.g. via Vercel Cron, GitHub Actions, or external cron).
 *
 * Optional: set KEEPALIVE_SECRET in env; then call with ?secret=... or header X-Keepalive-Secret.
 */
export async function GET(req: Request) {
  // Rate limiting: 5 requests per minute (belt-and-suspenders with secret auth)
  const ip = getClientIp(req.headers);
  const limit = checkRateLimit(ip, { windowMs: 60_000, maxRequests: 5 });
  if (!limit.allowed) {
    return apiError("Too many requests", 429);
  }
  const secret = process.env.KEEPALIVE_SECRET;
  if (secret) {
    const authHeader = req.headers.get("Authorization");
    const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const provided =
      req.headers.get("X-Keepalive-Secret") ??
      new URL(req.url).searchParams.get("secret") ??
      bearer;
    if (provided !== secret) {
      return apiError("Unauthorized", 401);
    }
  }

  try {
    const supabase = supabaseServer();
    const { error } = await supabase
      .from("organisations")
      .select("id")
      .limit(1);

    if (error) {
      return apiError(error.message, 500);
    }
    return apiOk({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500);
  }
}
