import { NextRequest, NextResponse } from "next/server";
import { requireTier } from "@/lib/requireTier";
import { supabaseServer } from "@/lib/supabaseServer";
import { hashPayload, generateVerificationId, anchorOnChain } from "@/lib/prove/chain";

// ---------------------------------------------------------------------------
// GET /api/prove/incident-locks — list incident locks for the user's org
// ---------------------------------------------------------------------------
// Query params: incident_id, page, per_page

export async function GET(req: NextRequest) {
  try {
    const check = await requireTier("Verify");
    if (!check.authorized) return check.response;
    if (!check.orgId) {
      return NextResponse.json({ error: "No organisation linked" }, { status: 400 });
    }

    const params = req.nextUrl.searchParams;
    const incidentId = params.get("incident_id") || "";
    const page = Math.max(1, Number(params.get("page") || 1));
    const perPage = Math.min(100, Math.max(1, Number(params.get("per_page") || 20)));
    const offset = (page - 1) * perPage;

    const db = supabaseServer();

    let query = db
      .from("prove_incident_locks")
      .select("*", { count: "exact" })
      .eq("organisation_id", check.orgId)
      .order("created_at", { ascending: false })
      .range(offset, offset + perPage - 1);

    if (incidentId) query = query.eq("incident_id", incidentId);

    const { data, count, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ locks: data ?? [], total: count ?? 0 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/prove/incident-locks — lock an incident with cryptographic proof
// ---------------------------------------------------------------------------
// Body: { incident_id, lock_reason }

export async function POST(req: NextRequest) {
  try {
    const check = await requireTier("Verify");
    if (!check.authorized) return check.response;
    if (!check.orgId) {
      return NextResponse.json({ error: "No organisation linked" }, { status: 400 });
    }

    const body = await req.json();
    const { incident_id, lock_reason } = body;

    if (!incident_id || !lock_reason) {
      return NextResponse.json(
        { error: "incident_id and lock_reason are required" },
        { status: 400 }
      );
    }

    const db = supabaseServer();

    // Fetch the full incident and verify org ownership
    const { data: incident, error: incidentError } = await db
      .from("incidents")
      .select(
        "title, description, impact_level, status, resolution, reported_by, created_at, resolved_at"
      )
      .eq("id", incident_id)
      .eq("organisation_id", check.orgId)
      .single();

    if (incidentError || !incident) {
      return NextResponse.json(
        { error: "Incident not found or does not belong to your organisation" },
        { status: 404 }
      );
    }

    // Build snapshot of the incident at lock time
    const snapshot = {
      title: incident.title,
      description: incident.description,
      impact_level: incident.impact_level,
      status: incident.status,
      resolution: incident.resolution,
      reported_by: incident.reported_by,
      created_at: incident.created_at,
      resolved_at: incident.resolved_at,
    };

    const now = new Date().toISOString();

    // Generate event hash and verification ID
    const eventHash = hashPayload({
      type: "incident_lock",
      incident_id,
      snapshot,
      locked_at: now,
      locked_by: check.userId,
    });

    const verificationId = generateVerificationId({
      type: "incident_lock",
      incident_id,
      snapshot,
      locked_at: now,
      locked_by: check.userId,
    });

    // Attempt chain anchoring
    const chainResult = await anchorOnChain(eventHash);

    // Insert the lock record
    const { data, error } = await db
      .from("prove_incident_locks")
      .insert({
        organisation_id: check.orgId,
        incident_id,
        lock_reason,
        snapshot,
        locked_by: check.userId,
        locked_at: now,
        verification_id: verificationId,
        event_hash: eventHash,
        chain_tx_hash: chainResult.txHash,
        chain_status: chainResult.status,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
