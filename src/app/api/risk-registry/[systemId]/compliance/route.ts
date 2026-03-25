import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";
import { z } from "zod";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ systemId: string }> }
) {
  const { systemId } = await params;
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  // Get org user IDs for ownership check
  const { data: orgUsers } = await auth.db
    .from("profiles")
    .select("id")
    .eq("organisation_id", auth.orgId);

  const userIds = (orgUsers ?? []).map((u: { id: string }) => u.id);

  // Get system's risk category (org-scoped)
  const { data: system } = await auth.db
    .from("systems")
    .select("id, risk_category")
    .eq("id", systemId)
    .in("owner_id", userIds)
    .single();

  if (!system) return apiError("System not found", 404);

  // Get all requirements relevant to this risk category
  const { data: requirements } = await auth.db
    .from("compliance_requirements")
    .select("*")
    .contains("risk_categories", [system.risk_category]);

  // Get existing compliance mappings
  const { data: mappings } = await auth.db
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

  return apiOk({ data: compliance });
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
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const parsed = updateComplianceSchema.safeParse(await req.json());
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const body = parsed.data;

  // Get org user IDs for ownership check
  const { data: orgUsersPost } = await auth.db
    .from("profiles")
    .select("id")
    .eq("organisation_id", auth.orgId);

  const postUserIds = (orgUsersPost ?? []).map((u: { id: string }) => u.id);

  const { data: systemCheck } = await auth.db
    .from("systems")
    .select("id")
    .eq("id", systemId)
    .in("owner_id", postUserIds)
    .single();

  if (!systemCheck) return apiError("System not found", 404);

  const { data, error } = await auth.db
    .from("system_compliance_map")
    .upsert({
      system_id: systemId,
      requirement_id: body.requirement_id,
      status: body.status,
      notes: body.notes ?? null,
      assessed_at: new Date().toISOString(),
      assessed_by: auth.user.id,
    }, { onConflict: "system_id,requirement_id" })
    .select()
    .single();

  if (error) return apiError(error.message, 500);

  return apiOk({ data });
}
