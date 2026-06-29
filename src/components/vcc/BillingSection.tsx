"use client";

import { useCallback, useEffect, useState } from "react";
import ConfirmDialog from "@/components/vcc/ConfirmDialog";
import { useVCCAuth } from "@/context/VCCAuthContext";

// ---------------------------------------------------------------------------
// Types — mirror the GET /stripe endpoint response shape
// ---------------------------------------------------------------------------

type StripeBillingData = {
  has_stripe_customer: boolean;
  customer: {
    id: string;
    email: string | null;
    created: number;
    livemode: boolean;
  } | null;
  subscription: {
    id: string;
    status: string;
    current_period_end: number | null;
    cancel_at_period_end: boolean;
    canceled_at: number | null;
    plan_amount: number | null;
    plan_currency: string | null;
    plan_interval: string | null;
    latest_invoice_id: string | null;
  } | null;
  payment_method: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  } | null;
  invoices: Array<{
    id: string;
    number: string | null;
    status: string | null;
    amount_paid: number;
    amount_due: number;
    currency: string;
    created: number;
    paid_at: number | null;
    hosted_invoice_url: string | null;
    invoice_pdf: string | null;
    charge_id: string | null;
  }>;
  latest_charge_id: string | null;
  latest_charge_amount: number | null;
  latest_charge_currency: string | null;
  dashboardUrl: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMoney(amount: number | null, currency: string | null): string {
  if (amount === null || !currency) return "—";
  const cur = currency.toUpperCase();
  const symbol = cur === "GBP" ? "£" : cur === "USD" ? "$" : cur === "EUR" ? "€" : "";
  return `${symbol}${(amount / 100).toFixed(2)}${symbol ? "" : ` ${cur}`}`;
}

function formatDate(epochSeconds: number | null): string {
  if (!epochSeconds) return "—";
  return new Date(epochSeconds * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function subscriptionStatusBadge(status: string, cancelAtPeriodEnd: boolean) {
  if (status === "active" && cancelAtPeriodEnd) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
        ● Cancelling at period end
      </span>
    );
  }
  const colour: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    trialing: "bg-blue-100 text-blue-700",
    past_due: "bg-red-100 text-red-700",
    canceled: "bg-gray-100 text-gray-600",
    incomplete: "bg-amber-100 text-amber-700",
    incomplete_expired: "bg-gray-100 text-gray-600",
    unpaid: "bg-red-100 text-red-700",
    paused: "bg-amber-100 text-amber-700",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        colour[status] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      ● {status.replace(/_/g, " ")}
    </span>
  );
}

function invoiceStatusBadge(status: string | null) {
  const colour: Record<string, string> = {
    paid: "bg-green-100 text-green-700",
    open: "bg-amber-100 text-amber-700",
    void: "bg-gray-100 text-gray-600",
    uncollectible: "bg-red-100 text-red-700",
    draft: "bg-gray-100 text-gray-600",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        colour[status ?? ""] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {status ?? "—"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BillingSection({ orgId }: { orgId: string }) {
  const { hasPermission } = useVCCAuth();
  const [data, setData] = useState<StripeBillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refund dialog
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundLoading, setRefundLoading] = useState(false);

  // Cancel-at-period-end dialog
  const [cancelEndOpen, setCancelEndOpen] = useState(false);
  const [cancelEndLoading, setCancelEndLoading] = useState(false);

  // Cancel-immediately dialog
  const [cancelNowOpen, setCancelNowOpen] = useState(false);
  const [cancelNowLoading, setCancelNowLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!hasPermission("view_stripe_billing")) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/verisum-admin/organisations/${orgId}/stripe`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Error ${res.status}`);
        return;
      }
      const { data: payload } = await res.json();
      setData(payload as StripeBillingData);
    } catch {
      setError("Failed to load Stripe data");
    } finally {
      setLoading(false);
    }
  }, [orgId, hasPermission]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefund = useCallback(
    async (reason: string) => {
      if (!data?.latest_charge_id) return;
      setRefundLoading(true);
      try {
        const res = await fetch(
          `/api/verisum-admin/organisations/${orgId}/stripe/refund`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chargeId: data.latest_charge_id, reason }),
          }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          alert(body.error ?? "Failed to refund");
          return;
        }
        setRefundOpen(false);
        alert("Refund issued successfully");
        fetchData();
      } catch {
        alert("Failed to refund");
      } finally {
        setRefundLoading(false);
      }
    },
    [orgId, data, fetchData]
  );

  const handleCancel = useCallback(
    async (reason: string, immediate: boolean) => {
      const setLoading = immediate ? setCancelNowLoading : setCancelEndLoading;
      const setOpen = immediate ? setCancelNowOpen : setCancelEndOpen;
      setLoading(true);
      try {
        const res = await fetch(
          `/api/verisum-admin/organisations/${orgId}/stripe/cancel`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason, immediate }),
          }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          alert(body.error ?? "Failed to cancel");
          return;
        }
        setOpen(false);
        alert(immediate ? "Subscription cancelled immediately" : "Subscription will cancel at period end");
        fetchData();
      } catch {
        alert("Failed to cancel");
      } finally {
        setLoading(false);
      }
    },
    [orgId, fetchData]
  );

  // Permission gate — section hidden entirely if user lacks view permission
  if (!hasPermission("view_stripe_billing")) return null;

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Billing</h2>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-red-900 mb-2">Billing</h2>
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  if (!data.has_stripe_customer) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Billing</h2>
        <p className="text-sm text-gray-600">
          This customer doesn&apos;t have a Stripe account yet — they haven&apos;t
          started a paid subscription.
        </p>
      </div>
    );
  }

  const sub = data.subscription;
  const canRefund = hasPermission("refund_payment") && !!data.latest_charge_id;
  const canCancel = hasPermission("cancel_subscription") &&
    !!sub &&
    sub.status === "active" &&
    !sub.cancel_at_period_end;

  return (
    <>
      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-5">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Billing</h2>
          {data.dashboardUrl && (
            <a
              href={data.dashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              Open in Stripe ↗
            </a>
          )}
        </div>

        {/* Subscription summary */}
        {sub ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div>
                <div className="text-sm text-gray-500">Subscription</div>
                <div className="text-base font-medium text-gray-900">
                  {formatMoney(sub.plan_amount, sub.plan_currency)}/{sub.plan_interval ?? "—"}
                </div>
              </div>
              <div className="ml-auto">
                {subscriptionStatusBadge(sub.status, sub.cancel_at_period_end)}
              </div>
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-gray-500">Current period ends</dt>
                <dd className="text-gray-900 mt-0.5">
                  {formatDate(sub.current_period_end)}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Payment method</dt>
                <dd className="text-gray-900 mt-0.5">
                  {data.payment_method
                    ? `${data.payment_method.brand.toUpperCase()} •••• ${data.payment_method.last4}`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Subscription ID</dt>
                <dd className="text-gray-900 font-mono text-xs mt-0.5">
                  {sub.id}
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <p className="text-sm text-gray-600">No active subscription.</p>
        )}

        {/* Action buttons */}
        {(canRefund || canCancel) && (
          <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
            {canRefund && (
              <button
                onClick={() => setRefundOpen(true)}
                className="px-3 py-1.5 text-sm font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
              >
                Refund last payment
                {data.latest_charge_amount !== null && (
                  <span className="ml-1 text-orange-600">
                    ({formatMoney(data.latest_charge_amount, data.latest_charge_currency)})
                  </span>
                )}
              </button>
            )}
            {canCancel && (
              <>
                <button
                  onClick={() => setCancelEndOpen(true)}
                  className="px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                >
                  Cancel at period end
                </button>
                <button
                  onClick={() => setCancelNowOpen(true)}
                  className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                >
                  Cancel immediately
                </button>
              </>
            )}
          </div>
        )}

        {/* Invoices */}
        {data.invoices.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Recent invoices
            </h3>
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500">
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 font-medium">Date</th>
                  <th className="text-left py-2 font-medium">Amount</th>
                  <th className="text-left py-2 font-medium">Status</th>
                  <th className="text-right py-2 font-medium">Links</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-gray-50">
                    <td className="py-2 text-gray-900">{formatDate(inv.created)}</td>
                    <td className="py-2 text-gray-900">
                      {formatMoney(inv.amount_paid || inv.amount_due, inv.currency)}
                    </td>
                    <td className="py-2">{invoiceStatusBadge(inv.status)}</td>
                    <td className="py-2 text-right space-x-2">
                      {inv.hosted_invoice_url && (
                        <a
                          href={inv.hosted_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          View
                        </a>
                      )}
                      {inv.invoice_pdf && (
                        <a
                          href={inv.invoice_pdf}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          PDF
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Refund dialog */}
      <ConfirmDialog
        open={refundOpen}
        title="Refund last payment"
        description={`Issue a full refund of ${formatMoney(
          data.latest_charge_amount,
          data.latest_charge_currency
        )} to this customer. The refund will appear in their bank account within 1-5 business days. The subscription stays active unless you also cancel it.`}
        confirmLabel="Issue refund"
        variant="warning"
        requireReason
        loading={refundLoading}
        onConfirm={handleRefund}
        onCancel={() => setRefundOpen(false)}
      />

      {/* Cancel at period end dialog */}
      <ConfirmDialog
        open={cancelEndOpen}
        title="Cancel subscription at period end"
        description={`The customer will keep access until ${formatDate(
          sub?.current_period_end ?? null
        )}. After that, their subscription will be cancelled and they will downgrade to Explorer. No refund is issued.`}
        confirmLabel="Schedule cancellation"
        variant="warning"
        requireReason
        loading={cancelEndLoading}
        onConfirm={(reason) => handleCancel(reason, false)}
        onCancel={() => setCancelEndOpen(false)}
      />

      {/* Cancel immediately dialog */}
      <ConfirmDialog
        open={cancelNowOpen}
        title="Cancel subscription IMMEDIATELY"
        description="The customer loses access RIGHT NOW. They will be downgraded to Explorer. This is for fraud, ToS violations, or explicit customer requests. No automatic refund — issue one separately if needed."
        confirmLabel="Cancel immediately"
        variant="danger"
        requireReason
        loading={cancelNowLoading}
        onConfirm={(reason) => handleCancel(reason, true)}
        onCancel={() => setCancelNowOpen(false)}
      />
    </>
  );
}
