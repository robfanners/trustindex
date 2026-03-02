import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { maxStaffDeclarations } from "@/lib/entitlements";

// GET — validate token, return org name + token status (public, no auth)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const sb = supabaseServer();

    // Look up token
    const { data: tokenRow, error } = await sb
      .from("declaration_tokens")
      .select("id, organisation_id, label, expires_at, is_active")
      .eq("token", token)
      .single();

    if (error || !tokenRow) {
      return NextResponse.json(
        { error: "Invalid declaration link" },
        { status: 404 }
      );
    }

    // Check active
    if (!tokenRow.is_active) {
      return NextResponse.json(
        { error: "This declaration link has been deactivated" },
        { status: 410 }
      );
    }

    // Check expiry
    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "This declaration link has expired" },
        { status: 410 }
      );
    }

    // Get org name
    const { data: org } = await sb
      .from("organisations")
      .select("name")
      .eq("id", tokenRow.organisation_id)
      .single();

    return NextResponse.json({
      valid: true,
      organisationName: org?.name ?? "Your organisation",
      label: tokenRow.label,
    });
  } catch (err: unknown) {
    console.error("[declarations] GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// POST — submit staff declaration (public, no auth required)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const sb = supabaseServer();

    // Look up token
    const { data: tokenRow, error: tokenErr } = await sb
      .from("declaration_tokens")
      .select("id, organisation_id, is_active, expires_at")
      .eq("token", token)
      .single();

    if (tokenErr || !tokenRow) {
      return NextResponse.json(
        { error: "Invalid declaration link" },
        { status: 404 }
      );
    }

    if (!tokenRow.is_active) {
      return NextResponse.json(
        { error: "This declaration link has been deactivated" },
        { status: 410 }
      );
    }

    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "This declaration link has expired" },
        { status: 410 }
      );
    }

    // Check declaration count against plan limits
    // Find the org owner's plan
    const { data: orgOwner } = await sb
      .from("profiles")
      .select("id, plan")
      .eq("organisation_id", tokenRow.organisation_id)
      .limit(1)
      .single();

    if (orgOwner) {
      const limit = maxStaffDeclarations(orgOwner.plan);
      const { count } = await sb
        .from("staff_declarations")
        .select("id", { count: "exact", head: true })
        .eq("organisation_id", tokenRow.organisation_id);

      if ((count ?? 0) >= limit) {
        return NextResponse.json(
          { error: "Declaration limit reached for this organisation's plan" },
          { status: 403 }
        );
      }
    }

    // Parse body
    const body = await req.json();
    const { staffName, staffEmail, department, toolsDeclared, additionalNotes } =
      body;

    if (!staffName || !toolsDeclared || !Array.isArray(toolsDeclared)) {
      return NextResponse.json(
        { error: "Missing required fields: staffName, toolsDeclared" },
        { status: 400 }
      );
    }

    // Insert declaration
    const { data: declaration, error: declErr } = await sb
      .from("staff_declarations")
      .insert({
        organisation_id: tokenRow.organisation_id,
        token_id: tokenRow.id,
        staff_name: staffName,
        staff_email: staffEmail || null,
        department: department || null,
        tools_declared: toolsDeclared,
        additional_notes: additionalNotes || null,
      })
      .select()
      .single();

    if (declErr) {
      console.error("[declarations] Error saving declaration:", declErr);
      return NextResponse.json(
        { error: "Failed to save declaration" },
        { status: 500 }
      );
    }

    // Auto-populate ai_vendors from tools_declared
    for (const tool of toolsDeclared) {
      if (!tool.name) continue;

      // Check if vendor already exists for this org
      const { data: existing } = await sb
        .from("ai_vendors")
        .select("id")
        .eq("organisation_id", tokenRow.organisation_id)
        .ilike("vendor_name", tool.name)
        .maybeSingle();

      if (!existing) {
        await sb.from("ai_vendors").insert({
          organisation_id: tokenRow.organisation_id,
          vendor_name: tool.name,
          data_types: tool.dataTypes || [],
          source: "declaration",
          risk_category: "unassessed",
        });
      }
    }

    return NextResponse.json({ declaration });
  } catch (err: unknown) {
    console.error("[declarations] POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
