import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/vcc/adminAuth";
import { supabaseServer } from "@/lib/supabaseServer";
import { auditLog } from "@/lib/vcc/audit";
import type { PlanName } from "@/lib/entitlements";

const VALID_PLANS: PlanName[] = ["explorer", "pro", "enterprise"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const auth = await requireAdmin("change_plans");
    if ("error" in auth) return auth.error;

    const { orgId } = await params;
    const body = await request.json();
    const plan = body.plan as string;
    const reason = String(body.reason ?? "").trim();

    if (!VALID_PLANS.includes(plan as PlanName)) {
      return NextResponse.json(
        { error: "plan must be 'explorer', 'pro', or 'enterprise'" },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json(
        { error: "reason is required" },
        { status: 400 }
      );
    }

    const db = supabaseServer();

    // Before snapshot
    const { data: before, error: fetchErr } = await db
      .from("profiles")
      .select("id, email, plan")
      .eq("id", orgId)
      .single();

    if (fetchErr || !before) {
      return NextResponse.json(
        { error: "Organisation not found" },
        { status: 404 }
      );
    }

    // Update plan
    const { data: after, error: updateErr } = await db
      .from("profiles")
      .update({ plan })
      .eq("id", orgId)
      .select("id, email, plan")
      .single();

    if (updateErr || !after) {
      return NextResponse.json(
        { error: updateErr?.message ?? "Failed to update plan" },
        { status: 500 }
      );
    }

    // Audit log
    await auditLog({
      adminUserId: auth.user.id,
      adminEmail: auth.user.email,
      adminRoles: auth.roles,
      action: "org.plan_changed",
      targetType: "organisation",
      targetId: orgId,
      reason,
      beforeSnapshot: before as unknown as Record<string, unknown>,
      afterSnapshot: after as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ data: after });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
