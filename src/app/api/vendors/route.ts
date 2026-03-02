import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { maxVendors } from "@/lib/entitlements";

// GET — list vendors for org
export async function GET() {
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

    const limit = maxVendors(profile.plan);

    const { data: vendors, error } = await sb
      .from("ai_vendors")
      .select("*")
      .eq("organisation_id", profile.organisation_id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch vendors" }, { status: 500 });
    }

    return NextResponse.json({
      vendors: vendors ?? [],
      limit,
      count: vendors?.length ?? 0,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST — add vendor
export async function POST(req: Request) {
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

    // Check limit
    const limit = maxVendors(profile.plan);
    const { count } = await sb
      .from("ai_vendors")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", profile.organisation_id);

    if ((count ?? 0) >= limit) {
      return NextResponse.json(
        { error: "Vendor limit reached. Upgrade your plan for more." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { vendorName, vendorUrl, dataLocation, dataTypes, riskCategory, notes } = body;

    if (!vendorName) {
      return NextResponse.json({ error: "vendorName is required" }, { status: 400 });
    }

    const { data: vendor, error } = await sb
      .from("ai_vendors")
      .insert({
        organisation_id: profile.organisation_id,
        vendor_name: vendorName,
        vendor_url: vendorUrl || null,
        data_location: dataLocation || null,
        data_types: dataTypes || [],
        risk_category: riskCategory || "unassessed",
        source: "manual",
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to add vendor" }, { status: 500 });
    }

    return NextResponse.json({ vendor });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH — update vendor
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
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Map camelCase to snake_case for allowed fields
    const allowedUpdates: Record<string, unknown> = {};
    if (updates.vendorName !== undefined) allowedUpdates.vendor_name = updates.vendorName;
    if (updates.vendorUrl !== undefined) allowedUpdates.vendor_url = updates.vendorUrl;
    if (updates.dataLocation !== undefined) allowedUpdates.data_location = updates.dataLocation;
    if (updates.dataTypes !== undefined) allowedUpdates.data_types = updates.dataTypes;
    if (updates.riskCategory !== undefined) {
      allowedUpdates.risk_category = updates.riskCategory;
      allowedUpdates.manual_override = true;
    }
    if (updates.notes !== undefined) allowedUpdates.notes = updates.notes;
    allowedUpdates.updated_at = new Date().toISOString();

    const { data: vendor, error } = await sb
      .from("ai_vendors")
      .update(allowedUpdates)
      .eq("id", id)
      .eq("organisation_id", profile.organisation_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to update vendor" }, { status: 500 });
    }

    return NextResponse.json({ vendor });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE — remove vendor
export async function DELETE(req: Request) {
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

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { error } = await sb
      .from("ai_vendors")
      .delete()
      .eq("id", id)
      .eq("organisation_id", profile.organisation_id);

    if (error) {
      return NextResponse.json({ error: "Failed to delete vendor" }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
