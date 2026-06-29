import { getStripe } from "@/lib/stripe";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";
import { getServerOrigin } from "@/lib/url";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user, plan, db } = auth;

  try {
    // Only explorer users can upgrade via checkout (existing paid users use portal)
    if (plan !== "explorer") {
      return apiError("Already on a paid plan. Use billing portal to change.", 400);
    }

    // Look up profile for email + Stripe customer ID
    const { data: profile, error: profileErr } = await db
      .from("profiles")
      .select("id, email, stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile) {
      return apiError("Could not load profile", 500);
    }

    // Parse body for plan + interval
    let targetPlan: "starter" | "pro" = "pro";
    let interval: "monthly" | "yearly" = "monthly";
    try {
      const body = await req.json();
      if (body.plan === "starter") targetPlan = "starter";
      if (body.interval === "yearly") interval = "yearly";
    } catch {
      // defaults
    }

    // Resolve price ID
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
      return apiError("Stripe price not configured", 500);
    }

    // Get or create Stripe customer
    let customerId = profile.stripe_customer_id;

    if (!customerId) {
      const customer = await getStripe().customers.create({
        email: profile.email || user.email || undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      await db
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    // Create Checkout Session
    const origin = getServerOrigin(req);

    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      // Land users in the app after payment, not back on pricing.
      // Dashboard reads ?upgraded=true to show a success banner and force
      // an auth-context refresh so the new plan state is visible immediately.
      success_url: `${origin}/dashboard?upgraded=true`,
      cancel_url: `${origin}/upgrade?cancelled=true`,
      metadata: { supabase_user_id: user.id, target_plan: targetPlan },
    });

    return apiOk({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("Stripe checkout error:", err);
    return apiError(message, 500);
  }
}
