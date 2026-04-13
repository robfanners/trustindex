import { NextRequest } from "next/server";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";
import { canViewIBG } from "@/lib/entitlements";

// ---------------------------------------------------------------------------
// GET /api/ibg/[assessmentId]/history — list all IBG spec versions
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { orgId, plan, db } = auth;

  try {
    const { assessmentId } = await params;

    if (!canViewIBG(plan)) {
      return apiError("Upgrade to view IBG specifications", 403);
    }

    const { data: specs, error: fetchErr } = await db
      .from("ibg_specifications")
      .select("id, version, status, created_at, approved_at, approved_by, effective_from, effective_until")
      .eq("assessment_id", assessmentId)
      .eq("organisation_id", orgId)
      .order("version", { ascending: false });

    if (fetchErr) {
      return apiError(fetchErr.message, 500);
    }

    return apiOk({ versions: specs ?? [] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500);
  }
}
