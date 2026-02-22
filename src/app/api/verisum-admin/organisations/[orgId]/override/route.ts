import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/vcc/adminAuth";
import { supabaseServer } from "@/lib/supabaseServer";
import { auditLog } from "@/lib/vcc/audit";

// ---------------------------------------------------------------------------
// POST /api/verisum-admin/organisations/[orgId]/override — Plan limit override
// ---------------------------------------------------------------------------

const VALID_TYPES = ["max_surveys", "max_systems", "can_export"] as const;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const auth = await requireAdmin("override_limits");
    if ("error" in auth) return auth.error;

    const { orgId } = await params;
    const body = await request.json();

    const overrideType = body.override_type as string;
    const overrideValue = String(body.override_value ?? "").trim();
    const reason = String(body.reason ?? "").trim();
    const expiresAt = body.expires_at
      ? String(body.expires_at).trim()
      : null;

    // Validate
    if (!VALID_TYPES.includes(overrideType as (typeof VALID_TYPES)[number])) {
      return NextResponse.json(
        {
          error: `override_type must be one of: ${VALID_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (!overrideValue) {
      return NextResponse.json(
        { error: "override_value is required" },
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

    // Verify the org exists
    const { data: profile, error: profErr } = await db
      .from("profiles")
      .select("id")
      .eq("id", orgId)
      .single();

    if (profErr || !profile) {
      return NextResponse.json(
        { error: "Organisation not found" },
        { status: 404 }
      );
    }

    // Insert override
    const { data: override, error: insertErr } = await db
      .from("org_overrides")
      .insert({
        user_id: orgId,
        override_type: overrideType,
        override_value: overrideValue,
        reason,
        expires_at: expiresAt,
        created_by: auth.user.id,
      })
      .select("id, override_type, override_value, reason, expires_at, created_at")
      .single();

    if (insertErr || !override) {
      return NextResponse.json(
        { error: insertErr?.message ?? "Failed to create override" },
        { status: 500 }
      );
    }

    // Write audit log
    await auditLog({
      adminUserId: auth.user.id,
      adminEmail: auth.user.email,
      adminRoles: auth.roles,
      action: "org.override_created",
      targetType: "organisation",
      targetId: orgId,
      reason,
      afterSnapshot: override as unknown as Record<string, unknown>,
      metadata: { override_type: overrideType, override_value: overrideValue },
    });

    return NextResponse.json({ data: override }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
