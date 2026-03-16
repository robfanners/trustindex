import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { z } from "zod";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ systemId: string }> }
) {
  const { systemId } = await params;
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const db = supabaseServer();

  // Get system's risk category
  const { data: system } = await db
    .from("systems")
    .select("id, risk_category")
    .eq("id", systemId)
    .single();

  if (!system) return NextResponse.json({ error: "System not found" }, { status: 404 });

  // Get all requirements relevant to this risk category
  const { data: requirements } = await db
    .from("compliance_requirements")
    .select("*")
    .contains("risk_categories", [system.risk_category]);

  // Get existing compliance mappings
  const { data: mappings } = await db
    .from("system_compliance_map")
    .select("*")
    .eq("system_id", systemId);

  const mappingByReq = new Map(
    (mappings ?? []).map((m: Record<string, unknown>) => [m.requirement_id, m])
  );

  const compliance = (requirements ?? []).map((req: Record<string, unknown>) => ({
    ...req,
    compliance_status: mappingByReq.get(req.id as string)
      ?? { status: "not_assessed", notes: null, assessed_at: null },
  }));

  return NextResponse.json({ data: compliance });
}

const updateComplianceSchema = z.object({
  requirement_id: z.string().uuid(),
  status: z.enum(["not_assessed", "compliant", "partially_compliant", "non_compliant", "not_applicable"]),
  notes: z.string().max(2000).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ systemId: string }> }
) {
  const { systemId } = await params;
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = updateComplianceSchema.parse(await req.json());
  const db = supabaseServer();

  const { data, error } = await db
    .from("system_compliance_map")
    .upsert({
      system_id: systemId,
      requirement_id: body.requirement_id,
      status: body.status,
      notes: body.notes ?? null,
      assessed_at: new Date().toISOString(),
      assessed_by: user.id,
    }, { onConflict: "system_id,requirement_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}
