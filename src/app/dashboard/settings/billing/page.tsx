"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { hasBillingAccess } from "@/lib/entitlements";

// ---------------------------------------------------------------------------
// /dashboard/settings/billing — Billing & subscription
// ---------------------------------------------------------------------------

type BillingData = {
  plan: string;
  interval: string | null;
  status: string | null;
  renewal_date: string | null;
  stripe_customer_id: string | null;
};

export default function BillingSettingsPage() {
  const { profile } = useAuth();
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/billing")
      .then((r) => (r.ok ? r.json() : r.json().then((d) => Promise.reject(d.error))))
      .then((d) => setBilling(d))
      .catch((e) => setError(typeof e === "string" ? e : "Failed to load billing info"))
      .finally(() => setLoading(false));
  }, []);

  const handleManageBilling = useCallback(async () => {
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert(data.error || "Could not open billing portal.");
    } catch {
      alert("Could not open billing portal.");
    }
  }, []);

  // Plan gate: Explorer users shouldn't see this page
  if (!hasBillingAccess(profile?.plan)) {
    return (
      <div className="border border-border rounded-lg p-6 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Billing</h2>
        <p className="text-sm text-muted-foreground">
          Billing management is available on Pro and Enterprise plans.
        </p>
        <a
          href="/upgrade"
          className="inline-block px-4 py-2 rounded bg-brand text-white text-sm font-semibold hover:bg-brand-hover"
        >
          Upgrade your plan
        </a>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-sm text-muted-foreground py-4">
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading billing information...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current plan card */}
      <div className="border border-border rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Subscription</h2>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Plan</dt>
            <dd className="font-medium capitalize flex items-center gap-2">
              {billing?.plan ?? "—"}
              <span className="text-xs px-2 py-0.5 rounded-full bg-brand/10 text-brand font-medium capitalize">
                {billing?.plan}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Billing interval</dt>
            <dd className="font-medium capitalize">{billing?.interval ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium capitalize">
              {billing?.status ? (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    billing.status === "active"
                      ? "bg-green-100 text-green-700"
                      : billing.status === "canceled" || billing.status === "past_due"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {billing.status}
                </span>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Next renewal</dt>
            <dd className="font-medium">
              {billing?.renewal_date
                ? new Date(billing.renewal_date).toLocaleDateString()
                : "—"}
            </dd>
          </div>
        </dl>

        {/* Notices from PRD */}
        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border/30">
          <p>Changes take effect immediately.</p>
          <p>7-day cooling off period applies to new subscriptions.</p>
        </div>
      </div>

      {/* Actions */}
      <div className="border border-border rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Manage</h2>

        <div className="flex flex-wrap items-center gap-3">
          {billing?.stripe_customer_id && (
            <button
              onClick={handleManageBilling}
              className="px-4 py-2 rounded bg-brand text-white text-sm font-semibold hover:bg-brand-hover"
            >
              Manage subscription
            </button>
          )}
          <a
            href="/upgrade"
            className="text-sm text-brand underline hover:text-foreground transition-colors"
          >
            View plans & pricing
          </a>
        </div>
      </div>

      {/* Invoice history placeholder */}
      <div className="border border-border rounded-lg p-6 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Invoice history</h2>
        <p className="text-sm text-muted-foreground">
          Invoice history will be available in a future update. You can view
          past invoices via the Stripe billing portal above.
        </p>
      </div>

      {/* Discount code placeholder */}
      <div className="border border-border rounded-lg p-6 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Discount code</h2>
        <p className="text-sm text-muted-foreground">
          Discount codes will be available in a future update.
        </p>
      </div>
    </div>
  );
}
