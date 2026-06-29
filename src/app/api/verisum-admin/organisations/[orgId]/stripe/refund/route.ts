import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/vcc/adminAuth";
import { supabaseServer } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/vcc/audit";
import { getStripe } from "@/lib/stripe";

// ---------------------------------------------------------------------------
// POST /api/verisum-admin/organisations/[orgId]/stripe/refund
//
// Issues a FULL refund on the specified charge. Conservative by design —
// no partial refunds, no refund-any-charge: the caller must pass the exact
// charge_id that the GET endpoint surfaced. Audit-logged.
//
// Body: { chargeId: string, reason: string }
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const auth = await requireAdmin("refund_payment");
    if ("error" in auth) return auth.error;

    const { orgId } = await params;
    const body = await request.json().catch(() => ({}));
    const chargeId = String(body.chargeId ?? "").trim();
    const reason = String(body.reason ?? "").trim();

    if (!chargeId) {
      return NextResponse.json({ error: "chargeId is required" }, { status: 400 });
    }
    if (!reason) {
      return NextResponse.json({ error: "reason is required" }, { status: 400 });
    }
    if (!chargeId.startsWith("ch_")) {
      return NextResponse.json(
        { error: "chargeId must be a Stripe charge ID (ch_...)" },
        { status: 400 }
      );
    }

    const db = supabaseServer();
    const { data: profile, error: fetchErr } = await db
      .from("profiles")
      .select("id, email, stripe_customer_id")
      .eq("id", orgId)
      .single();

    if (fetchErr || !profile) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    if (!profile.stripe_customer_id) {
      return NextResponse.json(
        { error: "Customer has no Stripe account" },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    // Verify the charge belongs to this customer (defence in depth)
    const charge = await stripe.charges.retrieve(chargeId);
    if (charge.customer !== profile.stripe_customer_id) {
      return NextResponse.json(
        { error: "Charge does not belong to this customer" },
        { status: 400 }
      );
    }

    // Issue full refund
    const refund = await stripe.refunds.create({
      charge: chargeId,
      reason: "requested_by_customer",
      metadata: {
        verisum_admin_user_id: auth.user.id,
        verisum_admin_email: auth.user.email,
        verisum_reason: reason.slice(0, 500),
      },
    });

    // Audit log
    await auditLog({
      adminUserId: auth.user.id,
      adminEmail: auth.user.email,
      adminRoles: auth.roles,
      action: "stripe.refund_issued",
      targetType: "organisation",
      targetId: orgId,
      reason,
      metadata: {
        charge_id: chargeId,
        refund_id: refund.id,
        amount_refunded: refund.amount,
        currency: refund.currency,
      },
    });

    return NextResponse.json({
      data: {
        refund_id: refund.id,
        amount_refunded: refund.amount,
        currency: refund.currency,
        status: refund.status,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[admin/stripe/refund] unhandled error:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
