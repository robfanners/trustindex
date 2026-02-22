import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabaseServer";
import type Stripe from "stripe";

// Disable Next.js body parsing — we need the raw body for signature verification
export const runtime = "nodejs";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing signature or webhook secret" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    const rawBody = await req.text();
    event = getStripe().webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err?.message);
    return NextResponse.json(
      { error: `Webhook Error: ${err?.message}` },
      { status: 400 }
    );
  }

  const sb = supabaseServer();

  try {
    switch (event.type) {
      // -----------------------------------------------------------------------
      // Checkout completed → upgrade to Pro
      // -----------------------------------------------------------------------
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : (session.subscription as Stripe.Subscription | null)?.id ?? null;

        if (userId) {
          await sb
            .from("profiles")
            .update({
              plan: "pro",
              stripe_subscription_id: subscriptionId,
            })
            .eq("id", userId);

          console.log(`[stripe] User ${userId} upgraded to Pro (sub: ${subscriptionId})`);
        }
        break;
      }

      // -----------------------------------------------------------------------
      // Subscription deleted → downgrade to Explorer
      // -----------------------------------------------------------------------
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const subId = subscription.id;

        // Find user by subscription ID
        const { data: profile } = await sb
          .from("profiles")
          .select("id")
          .eq("stripe_subscription_id", subId)
          .maybeSingle();

        if (profile) {
          await sb
            .from("profiles")
            .update({
              plan: "explorer",
              stripe_subscription_id: null,
            })
            .eq("id", profile.id);

          console.log(`[stripe] User ${profile.id} downgraded to Explorer (sub deleted: ${subId})`);
        }
        break;
      }

      default:
        // Acknowledge all other event types
        break;
    }
  } catch (err: any) {
    console.error(`[stripe] Error processing ${event.type}:`, err);
    // Still return 200 so Stripe doesn't retry
  }

  return NextResponse.json({ received: true });
}
