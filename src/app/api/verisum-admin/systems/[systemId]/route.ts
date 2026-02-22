import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/vcc/adminAuth";
import { hasPermission } from "@/lib/vcc/permissions";
import { supabaseServer } from "@/lib/supabaseServer";
import { auditLog } from "@/lib/vcc/audit";

// ---------------------------------------------------------------------------
// GET /api/verisum-admin/systems/[systemId] — System detail with all runs
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ systemId: string }> }
) {
  try {
    const auth = await requireAdmin("view_system_runs");
    if ("error" in auth) return auth.error;

    const { systemId } = await params;
    const db = supabaseServer();

    // Fetch system
    const { data: system, error: sysErr } = await db
      .from("systems")
      .select(
        "id, owner_id, name, version_label, type, environment, archived, created_at"
      )
      .eq("id", systemId)
      .single();

    if (sysErr || !system) {
      return NextResponse.json(
        { error: "System not found" },
        { status: 404 }
      );
    }

    // Fetch owner email + all runs in parallel
    const [profileRes, runsRes] = await Promise.all([
      system.owner_id
        ? db
            .from("profiles")
            .select("email")
            .eq("id", system.owner_id)
            .single()
        : Promise.resolve({ data: null, error: null }),
      db
        .from("system_runs")
        .select(
          "id, version_label, status, overall_score, dimension_scores, risk_flags, created_at, submitted_at"
        )
        .eq("system_id", systemId)
        .order("created_at", { ascending: false }),
    ]);

    return NextResponse.json({
      data: {
        id: system.id,
        name: system.name,
        version_label: system.version_label,
        type: system.type ?? null,
        environment: system.environment ?? null,
        archived: system.archived,
        created_at: system.created_at,
        owner_id: system.owner_id,
        owner_email: profileRes.data?.email ?? null,
        runs: (runsRes.data ?? []).map((r) => ({
          id: r.id,
          version_label: r.version_label,
          status: r.status,
          overall_score: r.overall_score,
          dimension_scores: r.dimension_scores,
          risk_flags: r.risk_flags ?? [],
          created_at: r.created_at,
          submitted_at: r.submitted_at,
        })),
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/verisum-admin/systems/[systemId] — Archive system
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ systemId: string }> }
) {
  try {
    const auth = await requireAdmin("view_system_runs");
    if ("error" in auth) return auth.error;

    const { systemId } = await params;
    const body = await request.json();
    const action = body.action as string;
    const reason = String(body.reason ?? "").trim();

    if (action !== "archive") {
      return NextResponse.json(
        { error: "action must be 'archive'" },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json(
        { error: "reason is required" },
        { status: 400 }
      );
    }

    if (!hasPermission(auth.roles, "archive_systems")) {
      return NextResponse.json(
        { error: "Insufficient permission: archive_systems" },
        { status: 403 }
      );
    }

    const db = supabaseServer();

    // Fetch before snapshot
    const { data: before, error: fetchErr } = await db
      .from("systems")
      .select("id, name, archived")
      .eq("id", systemId)
      .single();

    if (fetchErr || !before) {
      return NextResponse.json(
        { error: "System not found" },
        { status: 404 }
      );
    }

    if (before.archived) {
      return NextResponse.json(
        { error: "System is already archived" },
        { status: 409 }
      );
    }

    const { error: updateErr } = await db
      .from("systems")
      .update({ archived: true })
      .eq("id", systemId);

    if (updateErr) {
      return NextResponse.json(
        { error: updateErr.message },
        { status: 500 }
      );
    }

    await auditLog({
      adminUserId: auth.user.id,
      adminEmail: auth.user.email,
      adminRoles: auth.roles,
      action: "system.archived",
      targetType: "system",
      targetId: systemId,
      reason,
      beforeSnapshot: { archived: false, name: before.name },
      afterSnapshot: { archived: true, name: before.name },
    });

    return NextResponse.json({ data: { archived: true } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
