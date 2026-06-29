import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/vcc/adminAuth";
import { supabaseServer } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/vcc/audit";
import { getStripe } from "@/lib/stripe";

// ---------------------------------------------------------------------------
// POST /api/verisum-admin/organisations/[orgId]/stripe/cancel
//
// Cancels the customer's active subscription. Default behaviour is "cancel
// at period end" (customer keeps access until they would have been billed
// again). Pass { immediate: true } to cancel immediately (only when needed
// for fraud, ToS violations, or explicit customer request to stop access).
//
// The Stripe webhook (customer.subscription.deleted) will fire and downgrade
// the user's plan to explorer in our DB — we don't need to update plan here.
//
// Body: { reason: string, immediate?: boolean }
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const auth = await requireAdmin("cancel_subscription");
    if ("error" in auth) return auth.error;

    const { orgId } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = String(body.reason ?? "").trim();
    const immediate = body.immediate === true;

    if (!reason) {
      return NextResponse.json({ error: "reason is required" }, { status: 400 });
    }

    const db = supabaseServer();
    const { data: profile, error: fetchErr } = await db
      .from("profiles")
      .select("id, email, stripe_customer_id, stripe_subscription_id")
      .eq("id", orgId)
      .single();

    if (fetchErr || !profile) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    if (!profile.stripe_subscription_id) {
      return NextResponse.json(
        { error: "Customer has no active subscription" },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const subscriptionId = profile.stripe_subscription_id;

    let updated;
    if (immediate) {
      updated = await stripe.subscriptions.cancel(subscriptionId);
    } else {
      updated = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
        metadata: {
          verisum_admin_user_id: auth.user.id,
          verisum_admin_email: auth.user.email,
          verisum_reason: reason.slice(0, 500),
        },
      });
    }

    // In Stripe API 2026+, `current_period_end` moved from Subscription to
    // SubscriptionItem. Use the first item's period as a proxy (subscriptions
    // with multiple items having different periods are rare in our context).
    const currentPeriodEnd =
      updated.items?.data?.[0]?.current_period_end ?? null;

    // Audit log
    await auditLog({
      adminUserId: auth.user.id,
      adminEmail: auth.user.email,
      adminRoles: auth.roles,
      action: immediate ? "stripe.subscription_cancelled_immediate" : "stripe.subscription_cancelled_at_period_end",
      targetType: "organisation",
      targetId: orgId,
      reason,
      metadata: {
        subscription_id: subscriptionId,
        immediate,
        status: updated.status,
        cancel_at_period_end: updated.cancel_at_period_end,
        canceled_at: updated.canceled_at,
        current_period_end: currentPeriodEnd,
      },
    });

    return NextResponse.json({
      data: {
        subscription_id: updated.id,
        status: updated.status,
        cancel_at_period_end: updated.cancel_at_period_end,
        canceled_at: updated.canceled_at,
        current_period_end: currentPeriodEnd,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[admin/stripe/cancel] unhandled error:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
