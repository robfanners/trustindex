import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  createComplianceFrameworkSchema,
  updateComplianceFrameworkSchema,
  firstZodError,
} from "@/lib/validations";

// ---------------------------------------------------------------------------
// Helper: authenticate and resolve organisation
// ---------------------------------------------------------------------------

async function resolveOrg() {
  const authClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      ),
    };
  }

  const db = supabaseServer();
  const { data: profile } = await db
    .from("profiles")
    .select("organisation_id")
    .eq("id", user.id)
    .single();

  if (!profile?.organisation_id) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "No organisation linked" },
        { status: 400 }
      ),
    };
  }

  return { ok: true as const, userId: user.id, orgId: profile.organisation_id };
}

// ---------------------------------------------------------------------------
// GET /api/compliance-frameworks — list all frameworks for the organisation
// ---------------------------------------------------------------------------

export async function GET() {
  const auth = await resolveOrg();
  if (!auth.ok) return auth.response;

  const db = supabaseServer();
  const { data, error } = await db
    .from("compliance_frameworks")
    .select("*")
    .eq("organisation_id", auth.orgId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ frameworks: data ?? [] });
}

// ---------------------------------------------------------------------------
// POST /api/compliance-frameworks — create a new framework
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const auth = await resolveOrg();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const parsed = createComplianceFrameworkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstZodError(parsed.error) },
      { status: 400 }
    );
  }

  const { name, short_name, coverage_pct, status, due_date, notes } =
    parsed.data;

  const db = supabaseServer();
  const { data, error } = await db
    .from("compliance_frameworks")
    .insert({
      organisation_id: auth.orgId,
      name,
      short_name: short_name || null,
      coverage_pct,
      status,
      due_date: due_date || null,
      notes: notes || null,
      created_by: auth.userId,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}

// ---------------------------------------------------------------------------
// PATCH /api/compliance-frameworks — update an existing framework
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  const auth = await resolveOrg();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const parsed = updateComplianceFrameworkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstZodError(parsed.error) },
      { status: 400 }
    );
  }

  const { id, ...updates } = parsed.data;

  // Strip undefined keys so we only send actual updates
  const cleanUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      cleanUpdates[key] = value;
    }
  }

  if (Object.keys(cleanUpdates).length === 0) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 }
    );
  }

  const db = supabaseServer();
  const { data, error } = await db
    .from("compliance_frameworks")
    .update(cleanUpdates)
    .eq("id", id)
    .eq("organisation_id", auth.orgId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { error: "Framework not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ data });
}
