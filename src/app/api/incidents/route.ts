import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getUserPlan, maxIncidentsPerMonth } from "@/lib/entitlements";

// GET — list incidents for org
export async function GET(req: Request) {
  try {
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const sb = supabaseServer();
    const { data: profile } = await sb
      .from("profiles")
      .select("organisation_id, plan")
      .eq("id", user.id)
      .single();

    if (!profile?.organisation_id) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    // Optional status filter
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");

    let query = sb
      .from("incidents")
      .select("*, ai_vendors(vendor_name)")
      .eq("organisation_id", profile.organisation_id)
      .order("created_at", { ascending: false });

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    const { data: incidents, error } = await query;

    if (error) {
      return NextResponse.json({ error: "Failed to fetch incidents" }, { status: 500 });
    }

    // Monthly count for limit check
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: monthlyCount } = await sb
      .from("incidents")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", profile.organisation_id)
      .gte("created_at", startOfMonth.toISOString());

    const limit = maxIncidentsPerMonth(profile.plan);

    return NextResponse.json({
      incidents: incidents ?? [],
      monthlyCount: monthlyCount ?? 0,
      monthlyLimit: limit,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 });
  }
}

// POST — create incident
export async function POST(req: Request) {
  try {
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const plan = await getUserPlan(user.id);

    const sb = supabaseServer();
    const { data: profile } = await sb
      .from("profiles")
      .select("organisation_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organisation_id) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    // Check monthly limit
    const limit = maxIncidentsPerMonth(plan);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count } = await sb
      .from("incidents")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", profile.organisation_id)
      .gte("created_at", startOfMonth.toISOString());

    if ((count ?? 0) >= limit) {
      return NextResponse.json(
        { error: "Monthly incident limit reached. Upgrade for unlimited." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { title, description, aiVendorId, impactLevel } = body;

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const { data: incident, error } = await sb
      .from("incidents")
      .insert({
        organisation_id: profile.organisation_id,
        title,
        description: description || null,
        ai_vendor_id: aiVendorId || null,
        impact_level: impactLevel || "low",
        reported_by: user.id,
      })
      .select("*, ai_vendors(vendor_name)")
      .single();

    if (error) {
      console.error("[incidents] Error creating:", error);
      return NextResponse.json({ error: "Failed to create incident" }, { status: 500 });
    }

    return NextResponse.json({ incident });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 });
  }
}

// PATCH — update incident (status, resolution)
export async function PATCH(req: Request) {
  try {
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const sb = supabaseServer();
    const { data: profile } = await sb
      .from("profiles")
      .select("organisation_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organisation_id) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const body = await req.json();
    const { id, status: newStatus, resolution, impactLevel } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (newStatus) updates.status = newStatus;
    if (resolution !== undefined) updates.resolution = resolution;
    if (impactLevel) updates.impact_level = impactLevel;
    if (newStatus === "resolved" || newStatus === "closed") {
      updates.resolved_at = new Date().toISOString();
    }

    const { data: incident, error } = await sb
      .from("incidents")
      .update(updates)
      .eq("id", id)
      .eq("organisation_id", profile.organisation_id)
      .select("*, ai_vendors(vendor_name)")
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to update incident" }, { status: 500 });
    }

    return NextResponse.json({ incident });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 });
  }
}
