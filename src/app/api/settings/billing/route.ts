import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";

// ---------------------------------------------------------------------------
// GET /api/settings/billing — billing summary from Stripe
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    // 1. Authenticate
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // 2. Get profile
    const db = supabaseServer();
    const { data: profile } = await db
      .from("profiles")
      .select("plan, stripe_customer_id, stripe_subscription_id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // 3. If no subscription, return basic info
    if (!profile.stripe_subscription_id) {
      return NextResponse.json({
        plan: profile.plan,
        interval: null,
        status: null,
        renewal_date: null,
        stripe_customer_id: profile.stripe_customer_id,
      });
    }

    // 4. Fetch subscription details from Stripe
    const stripe = getStripe();
    const subResponse = await stripe.subscriptions.retrieve(
      profile.stripe_subscription_id
    );
    const sub = subResponse as Stripe.Subscription;

    const firstItem = sub.items.data[0];
    const interval = firstItem?.price?.recurring?.interval ?? null;
    const periodEnd = firstItem?.current_period_end ?? null;
    const renewalDate = periodEnd
      ? new Date(periodEnd * 1000).toISOString()
      : null;

    return NextResponse.json({
      plan: profile.plan,
      interval,
      status: sub.status,
      renewal_date: renewalDate,
      stripe_customer_id: profile.stripe_customer_id,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("Billing API error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
