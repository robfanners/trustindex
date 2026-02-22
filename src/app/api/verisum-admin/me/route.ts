import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/vcc/adminAuth";

// ---------------------------------------------------------------------------
// GET /api/verisum-admin/me — Current admin identity + roles
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const auth = await requireAdmin("view_dashboard");
    if ("error" in auth) return auth.error;

    return NextResponse.json({
      data: {
        id: auth.user.id,
        email: auth.user.email,
        roles: auth.roles,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
