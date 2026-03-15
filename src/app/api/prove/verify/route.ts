import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  // Require authentication but not a specific tier
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const verificationId = req.nextUrl.searchParams.get("id");
  if (!verificationId) {
    return NextResponse.json({ error: "id parameter is required" }, { status: 400 });
  }

  const db = supabaseServer();

  // Search attestations first
  const { data: attestation } = await db
    .from("prove_attestations")
    .select("id, title, statement, attested_by, attested_at, verification_id, event_hash, chain_tx_hash, chain_status, organisation_id, created_at")
    .eq("verification_id", verificationId)
    .single();

  if (attestation) {
    // Fetch org name
    const { data: org } = await db
      .from("organisations")
      .select("name")
      .eq("id", attestation.organisation_id)
      .single();

    return NextResponse.json({
      found: true,
      type: "attestation",
      record: {
        ...attestation,
        organisation_name: org?.name ?? "Unknown",
      },
    });
  }

  // Search provenance
  const { data: provenance } = await db
    .from("prove_provenance")
    .select("id, title, ai_system, model_version, reviewed_by, reviewed_at, verification_id, event_hash, chain_tx_hash, chain_status, organisation_id, created_at")
    .eq("verification_id", verificationId)
    .single();

  if (provenance) {
    const { data: org } = await db
      .from("organisations")
      .select("name")
      .eq("id", provenance.organisation_id)
      .single();

    return NextResponse.json({
      found: true,
      type: "provenance",
      record: {
        ...provenance,
        organisation_name: org?.name ?? "Unknown",
      },
    });
  }

  // Search incident locks
  const { data: incidentLock } = await db
    .from("prove_incident_locks")
    .select("id, incident_id, lock_reason, snapshot, locked_by, locked_at, verification_id, event_hash, chain_tx_hash, chain_status, organisation_id, created_at")
    .eq("verification_id", verificationId)
    .single();

  if (incidentLock) {
    const { data: org } = await db
      .from("organisations")
      .select("name")
      .eq("id", incidentLock.organisation_id)
      .single();

    return NextResponse.json({
      found: true,
      type: "incident_lock",
      record: {
        ...incidentLock,
        organisation_name: org?.name ?? "Unknown",
      },
    });
  }

  return NextResponse.json({ found: false });
}
