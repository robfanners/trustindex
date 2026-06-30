import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/vcc/adminAuth";
import { supabaseServer } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";

// ---------------------------------------------------------------------------
// GET /api/verisum-admin/organisations/[orgId]/stripe
//
// Fetches Stripe billing data for a customer so admins can answer
// "did my payment go through?" / "what's my subscription status?" without
// leaving the admin panel.
//
// Returns:
// - customer: id, email, created, livemode
// - subscription: id, status, current_period_end, plan amount/currency/interval,
//   cancel_at_period_end, latest charge ID for refund button
// - payment_method: brand + last4 (no PII)
// - invoices: last 5 invoices with status, amount, hosted_invoice_url
// - dashboardUrl: deep link to the customer in Stripe dashboard
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const auth = await requireAdmin("view_stripe_billing");
    if ("error" in auth) return auth.error;

    const { orgId } = await params;
    const db = supabaseServer();

    // Look up profile to get stripe_customer_id
    const { data: profile, error: fetchErr } = await db
      .from("profiles")
      .select("id, email, stripe_customer_id, stripe_subscription_id, plan")
      .eq("id", orgId)
      .single();

    if (fetchErr || !profile) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    if (!profile.stripe_customer_id) {
      return NextResponse.json({
        data: {
          has_stripe_customer: false,
          customer: null,
          subscription: null,
          payment_method: null,
          invoices: [],
          dashboardUrl: null,
        },
      });
    }

    const stripe = getStripe();
    const customerId = profile.stripe_customer_id;

    // Fetch in parallel — speeds things up + each is independently catchable
    const [
      customerResult,
      subscriptionsResult,
      invoicesResult,
      paymentMethodsResult,
      chargesResult,
    ] = await Promise.allSettled([
      stripe.customers.retrieve(customerId),
      stripe.subscriptions.list({ customer: customerId, status: "all", limit: 1 }),
      stripe.invoices.list({ customer: customerId, limit: 5 }),
      stripe.paymentMethods.list({ customer: customerId, type: "card", limit: 1 }),
      // Stripe doesn't change invoice.status to "refunded" — refunds live on
      // the charge. Fetch recent charges so we can surface refund info
      // alongside each invoice in the admin UI.
      stripe.charges.list({ customer: customerId, limit: 10 }),
    ]);

    const customer =
      customerResult.status === "fulfilled" &&
      !(customerResult.value as Stripe.DeletedCustomer).deleted
        ? (customerResult.value as Stripe.Customer)
        : null;

    const subscription =
      subscriptionsResult.status === "fulfilled" &&
      subscriptionsResult.value.data.length > 0
        ? subscriptionsResult.value.data[0]
        : null;

    const invoices =
      invoicesResult.status === "fulfilled" ? invoicesResult.value.data : [];

    const paymentMethod =
      paymentMethodsResult.status === "fulfilled" &&
      paymentMethodsResult.value.data.length > 0
        ? paymentMethodsResult.value.data[0]
        : null;

    // Plan info — Stripe API v2023+ moved this around. Try .items first.
    let planAmount: number | null = null;
    let planCurrency: string | null = null;
    let planInterval: string | null = null;

    if (subscription?.items?.data?.[0]?.price) {
      const price = subscription.items.data[0].price;
      planAmount = price.unit_amount ?? null;
      planCurrency = price.currency ?? null;
      planInterval = price.recurring?.interval ?? null;
    }

    // Build invoice_id → refund_amount map from charges.
    //
    // In Stripe API 2026-01-28.clover, `charge.invoice` was removed from the
    // TS types (Stripe restructured how Charges link to Invoices). The runtime
    // payload may still include the field — we cast through `unknown` to read
    // it defensively. If Stripe truly removed it, the map stays empty and the
    // UI shows invoices without refund info (no regression vs prior behaviour).
    const charges =
      chargesResult.status === "fulfilled" ? chargesResult.value.data : [];
    const invoiceRefundMap = new Map<string, { amount: number; fully: boolean }>();
    for (const charge of charges) {
      if (charge.amount_refunded <= 0) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const linkedInvoice = (charge as unknown as { invoice?: string | { id?: string } }).invoice;
      if (!linkedInvoice) continue;
      const invoiceId =
        typeof linkedInvoice === "string" ? linkedInvoice : linkedInvoice.id;
      if (invoiceId) {
        invoiceRefundMap.set(invoiceId, {
          amount: charge.amount_refunded,
          fully: charge.refunded === true,
        });
      }
    }

    return NextResponse.json({
      data: {
        has_stripe_customer: true,
        customer: customer
          ? {
              id: customer.id,
              email: customer.email,
              created: customer.created,
              livemode: customer.livemode,
            }
          : null,
        subscription: subscription
          ? {
              id: subscription.id,
              status: subscription.status,
              // Stripe API 2026+: current_period_end moved to SubscriptionItem
              current_period_end:
                subscription.items?.data?.[0]?.current_period_end ?? null,
              cancel_at_period_end: subscription.cancel_at_period_end,
              canceled_at: subscription.canceled_at,
              plan_amount: planAmount,
              plan_currency: planCurrency,
              plan_interval: planInterval,
              latest_invoice_id:
                typeof subscription.latest_invoice === "string"
                  ? subscription.latest_invoice
                  : subscription.latest_invoice?.id ?? null,
            }
          : null,
        payment_method: paymentMethod?.card
          ? {
              brand: paymentMethod.card.brand,
              last4: paymentMethod.card.last4,
              exp_month: paymentMethod.card.exp_month,
              exp_year: paymentMethod.card.exp_year,
            }
          : null,
        invoices: invoices.map((inv) => {
          const refund = inv.id ? invoiceRefundMap.get(inv.id) : undefined;
          return {
            id: inv.id,
            number: inv.number,
            status: inv.status,
            amount_paid: inv.amount_paid,
            amount_due: inv.amount_due,
            currency: inv.currency,
            created: inv.created,
            paid_at: inv.status_transitions?.paid_at ?? null,
            hosted_invoice_url: inv.hosted_invoice_url,
            invoice_pdf: inv.invoice_pdf,
            amount_refunded: refund?.amount ?? 0,
            fully_refunded: refund?.fully ?? false,
          };
        }),
        // Refunds removed from in-app actions in v1 — admins refund via the
        // "Open in Stripe" deep link below. Will be added back post-panel
        // once we map the new Invoice→Payment structure in Stripe API 2026+.
        dashboardUrl: `https://dashboard.stripe.com/${customer?.livemode ? "" : "test/"}customers/${customerId}`,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[admin/stripe] unhandled error:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
