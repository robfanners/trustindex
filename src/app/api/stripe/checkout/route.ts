import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabaseServer";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { getServerOrigin } from "@/lib/url";

export async function POST(req: Request) {
  try {
    // 1. Authenticate
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // 2. Look up profile
    const sb = supabaseServer();
    const { data: profile, error: profileErr } = await sb
      .from("profiles")
      .select("id, email, plan, stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json(
        { error: "Could not load profile" },
        { status: 500 }
      );
    }

    // Only explorer users can upgrade via checkout (existing paid users use portal)
    if (profile.plan !== "explorer") {
      return NextResponse.json(
        { error: "Already on a paid plan. Use billing portal to change." },
        { status: 400 }
      );
    }

    // 3. Parse body for plan + interval
    let targetPlan: "starter" | "pro" = "pro";
    let interval: "monthly" | "yearly" = "monthly";
    try {
      const body = await req.json();
      if (body.plan === "starter") targetPlan = "starter";
      if (body.interval === "yearly") interval = "yearly";
    } catch {
      // defaults
    }

    // 4. Resolve price ID
    let priceId: string | undefined;
    if (targetPlan === "starter") {
      priceId =
        interval === "yearly"
          ? process.env.STRIPE_STARTER_YEARLY_PRICE_ID
          : process.env.STRIPE_STARTER_MONTHLY_PRICE_ID;
    } else {
      priceId =
        interval === "yearly"
          ? process.env.STRIPE_PRO_YEARLY_PRICE_ID
          : process.env.STRIPE_PRO_MONTHLY_PRICE_ID;
    }

    if (!priceId) {
      return NextResponse.json(
        { error: "Stripe price not configured" },
        { status: 500 }
      );
    }

    // 5. Get or create Stripe customer
    let customerId = profile.stripe_customer_id;

    if (!customerId) {
      const customer = await getStripe().customers.create({
        email: profile.email || user.email || undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      await sb
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    // 6. Create Checkout Session
    const origin = getServerOrigin(req);

    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/upgrade?success=true`,
      cancel_url: `${origin}/upgrade?cancelled=true`,
      metadata: { supabase_user_id: user.id, target_plan: targetPlan },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
