import { getStripe } from "@/lib/stripe";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";
import { getServerOrigin } from "@/lib/url";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { db } = auth;

  try {
    // Get Stripe customer ID
    const { data: profile } = await db
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", auth.user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return apiError("No billing account found", 400);
    }

    // Create portal session
    const origin = getServerOrigin(req);

    const session = await getStripe().billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}/dashboard/settings/billing`,
    });

    return apiOk({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("Stripe portal error:", err);
    return apiError(message, 500);
  }
}
