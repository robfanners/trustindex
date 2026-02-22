import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";

// ---------------------------------------------------------------------------
// POST /api/claim-explorer-run
// Links an anonymous Explorer survey run to the authenticated user's account,
// and optionally saves onboarding profile fields.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    // 1. Require authentication
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // 2. Parse body
    const body = await req.json();
    const runId = body.runId as string | undefined;
    const fullName = body.fullName as string | undefined;
    const companyName = body.companyName as string | undefined;
    const companySize = body.companySize as string | undefined;
    const role = body.role as string | undefined;

    if (!runId) {
      return NextResponse.json({ error: "runId is required" }, { status: 400 });
    }

    const db = supabaseServer();

    // 3. Verify the run exists and is unclaimed (owner_user_id IS NULL)
    const { data: run, error: runErr } = await db
      .from("survey_runs")
      .select("id, owner_user_id")
      .eq("id", runId)
      .single();

    if (runErr || !run) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    if (run.owner_user_id) {
      // Already claimed — not an error if it's the same user
      if (run.owner_user_id === user.id) {
        return NextResponse.json({ ok: true, alreadyClaimed: true });
      }
      return NextResponse.json(
        { error: "This survey is already linked to another account" },
        { status: 403 }
      );
    }

    // 4. Claim the run
    const { error: claimErr } = await db
      .from("survey_runs")
      .update({ owner_user_id: user.id })
      .eq("id", runId);

    if (claimErr) {
      return NextResponse.json({ error: claimErr.message }, { status: 500 });
    }

    // 5. Update profile with onboarding data (if provided)
    const profileUpdates: Record<string, string> = {};
    if (fullName?.trim()) profileUpdates.full_name = fullName.trim();
    if (companyName?.trim()) profileUpdates.company_name = companyName.trim();
    if (companySize?.trim()) profileUpdates.company_size = companySize.trim();
    if (role?.trim()) profileUpdates.role = role.trim();

    if (Object.keys(profileUpdates).length > 0) {
      await db
        .from("profiles")
        .update(profileUpdates)
        .eq("id", user.id);
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
