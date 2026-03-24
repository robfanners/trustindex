import { requireAuth, apiError, apiOk, withErrorHandling } from "@/lib/apiHelpers";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";

// ---------------------------------------------------------------------------
// GET /api/settings/billing — billing summary from Stripe
// ---------------------------------------------------------------------------

export async function GET() {
  return withErrorHandling(async () => {
    // 1. Authenticate
    const auth = await requireAuth({ orgOptional: true, withPlan: false });
    if (auth.error) return auth.error;
    const { user, db } = auth;

    // 2. Get profile (fetch additional Stripe fields)
    const { data: profile } = await db
      .from("profiles")
      .select("plan, stripe_customer_id, stripe_subscription_id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return apiError("Profile not found", 404);
    }

    // 3. If no subscription, return basic info
    if (!profile.stripe_subscription_id) {
      return apiOk({
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

    return apiOk({
      plan: profile.plan,
      interval,
      status: sub.status,
      renewal_date: renewalDate,
      stripe_customer_id: profile.stripe_customer_id,
    });
  });
}
