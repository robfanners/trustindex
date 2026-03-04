import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export async function GET(req: NextRequest) {
  // Rate limiting
  const ip = getClientIp(req.headers);
  const limit = checkRateLimit(ip, { windowMs: 60_000, maxRequests: 30 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } }
    );
  }

  const verificationId = req.nextUrl.searchParams.get("id");
  if (!verificationId) {
    return NextResponse.json({ error: "id parameter is required" }, { status: 400 });
  }

  // Basic format validation
  if (!/^VER-[A-F0-9]{8}$/i.test(verificationId)) {
    return NextResponse.json({ error: "Invalid verification ID format" }, { status: 400 });
  }

  const db = supabaseServer();

  // Search attestations first
  const { data: attestation } = await db
    .from("prove_attestations")
    .select("title, statement, attested_at, verification_id, event_hash, chain_tx_hash, chain_status, organisation_id, created_at")
    .eq("verification_id", verificationId)
    .single();

  if (attestation) {
    const { data: org } = await db
      .from("organisations")
      .select("name")
      .eq("id", attestation.organisation_id)
      .single();

    return NextResponse.json({
      found: true,
      type: "attestation",
      record: {
        title: attestation.title,
        statement: attestation.statement,
        attested_at: attestation.attested_at,
        verification_id: attestation.verification_id,
        event_hash: attestation.event_hash,
        chain_tx_hash: attestation.chain_tx_hash,
        chain_status: attestation.chain_status,
        organisation_name: org?.name ?? "Unknown",
        created_at: attestation.created_at,
      },
    });
  }

  // Search provenance
  const { data: provenance } = await db
    .from("prove_provenance")
    .select("title, ai_system, model_version, reviewed_at, verification_id, event_hash, chain_tx_hash, chain_status, organisation_id, created_at")
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
        title: provenance.title,
        ai_system: provenance.ai_system,
        model_version: provenance.model_version,
        reviewed_at: provenance.reviewed_at,
        verification_id: provenance.verification_id,
        event_hash: provenance.event_hash,
        chain_tx_hash: provenance.chain_tx_hash,
        chain_status: provenance.chain_status,
        organisation_name: org?.name ?? "Unknown",
        created_at: provenance.created_at,
      },
    });
  }

  // Search incident locks
  const { data: lock } = await db
    .from("prove_incident_locks")
    .select("snapshot, lock_reason, locked_at, verification_id, event_hash, chain_tx_hash, chain_status, organisation_id, created_at")
    .eq("verification_id", verificationId)
    .single();

  if (lock) {
    const { data: org } = await db
      .from("organisations")
      .select("name")
      .eq("id", lock.organisation_id)
      .single();

    const snapshot = lock.snapshot as Record<string, unknown> | null;

    return NextResponse.json({
      found: true,
      type: "incident_lock",
      record: {
        title: (snapshot?.title as string) ?? "Incident Lock",
        lock_reason: lock.lock_reason,
        impact_level: snapshot?.impact_level ?? null,
        incident_status: snapshot?.status ?? null,
        locked_at: lock.locked_at,
        verification_id: lock.verification_id,
        event_hash: lock.event_hash,
        chain_tx_hash: lock.chain_tx_hash,
        chain_status: lock.chain_status,
        organisation_name: org?.name ?? "Unknown",
        created_at: lock.created_at,
      },
    });
  }

  return NextResponse.json({ found: false });
}
