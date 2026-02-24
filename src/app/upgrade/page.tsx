"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/context/AuthContext";

// ---------------------------------------------------------------------------
// Plan data
// ---------------------------------------------------------------------------

type PlanTier = {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  cta: string;
  ctaStyle: "primary" | "secondary" | "outline";
};

const tiers: PlanTier[] = [
  {
    name: "Explorer",
    price: "Free",
    period: "",
    description:
      "Try a private self-assessment to see how trust is experienced in your organisation.",
    features: [
      "1 survey (self-assessment)",
      "Instant results with radar chart",
      "Band interpretation and actions",
      "No sign-up required to start",
    ],
    cta: "Get started free",
    ctaStyle: "outline",
  },
  {
    name: "Pro",
    price: "\u00a3199",
    period: "/month",
    description:
      "Run organisational surveys, track trust over time, and export data for your team.",
    features: [
      "Up to 5 surveys",
      "Up to 2 systems assessed",
      "CSV data export",
      "Historical tracking",
      "Dimension-level insights",
      "Priority support",
    ],
    highlighted: true,
    cta: "Upgrade to Pro",
    ctaStyle: "primary",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description:
      "For organisations that need unlimited capacity, governance tooling, and API access.",
    features: [
      "Unlimited surveys",
      "Unlimited systems",
      "Full CSV export",
      "Historical tracking",
      "Governance & audit trail",
      "API access",
      "SSO / SAML",
      "Dedicated account manager",
    ],
    cta: "Contact us",
    ctaStyle: "secondary",
  },
];

// Feature comparison for the matrix below the cards
const featureMatrix: { feature: string; explorer: string; pro: string; enterprise: string }[] = [
  { feature: "Surveys", explorer: "1", pro: "5", enterprise: "Unlimited" },
  { feature: "Systems assessed", explorer: "\u2014", pro: "2", enterprise: "Unlimited" },
  { feature: "CSV export", explorer: "\u2014", pro: "\u2713", enterprise: "\u2713" },
  { feature: "Historical tracking", explorer: "\u2014", pro: "\u2713", enterprise: "\u2713" },
  { feature: "Governance & audit", explorer: "\u2014", pro: "\u2014", enterprise: "\u2713" },
  { feature: "API access", explorer: "\u2014", pro: "\u2014", enterprise: "\u2713" },
  { feature: "SSO / SAML", explorer: "\u2014", pro: "\u2014", enterprise: "\u2713" },
];

// ---------------------------------------------------------------------------
// Inner content (uses useSearchParams, needs Suspense)
// ---------------------------------------------------------------------------

function UpgradeContent() {
  const searchParams = useSearchParams();
  const { user, profile, loading: authLoading } = useAuth();

  // Prevent hydration mismatch: first client render must match server render.
  // useAuth() may synchronously return authLoading=false if auth state is cached,
  // but the server always renders with authLoading=true. This guard ensures the
  // first client paint uses the same loading path as the server.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const showLoading = !mounted || authLoading;

  const success = searchParams.get("success") === "true";
  const cancelled = searchParams.get("cancelled") === "true";
  const currentPlan = profile?.plan ?? null;

  // Determine CTA for each tier based on auth state and plan
  function ctaFor(tier: PlanTier) {
    if (showLoading) {
      return { label: tier.cta, href: "#", disabled: true };
    }

    if (tier.name === "Explorer") {
      if (!user) return { label: "Try free", href: "/try", disabled: false };
      if (currentPlan === "explorer")
        return { label: "Current plan", href: "#", disabled: true };
      return { label: "Explorer", href: "/dashboard", disabled: true };
    }

    if (tier.name === "Pro") {
      if (!user) return { label: "Sign in to upgrade", href: "/auth/login", disabled: false };
      if (currentPlan === "pro")
        return { label: "Current plan", href: "#", disabled: true };
      if (currentPlan === "enterprise")
        return { label: "Enterprise", href: "#", disabled: true };
      // Explorer user -> upgrade via Stripe
      return { label: "Upgrade to Pro", href: "#checkout", disabled: false };
    }

    // Enterprise
    return {
      label: "Contact us",
      href: "mailto:hello@verisum.org?subject=TrustGraph%20Enterprise%20enquiry",
      disabled: false,
    };
  }

  async function handleCheckout() {
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval: "monthly" }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Could not start checkout. Please try again.");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-12 space-y-12">
      {/* Success / cancelled banners */}
      {success && (
        <div className="border border-success rounded-lg p-4 bg-green-50 text-sm">
          <span className="font-semibold text-success">
            Payment successful.
          </span>{" "}
          Your plan has been upgraded to Pro. It may take a moment to reflect in
          your dashboard.
        </div>
      )}
      {cancelled && (
        <div className="border border-warning rounded-lg p-4 bg-yellow-50 text-sm">
          <span className="font-semibold text-warning">
            Checkout cancelled.
          </span>{" "}
          No charge was made. You can upgrade at any time.
        </div>
      )}

      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl md:text-4xl font-bold">
          Plans &amp; pricing
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Start free with Explorer. Upgrade when you need organisational
          surveys, data export, and systems assessment.
        </p>
      </div>

      {/* Pricing cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {tiers.map((tier) => {
          const cta = ctaFor(tier);
          return (
            <div
              key={tier.name}
              className={`border rounded-lg p-6 flex flex-col justify-between space-y-6 ${
                tier.highlighted
                  ? "border-brand border-2 relative"
                  : "border-border"
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand text-white text-xs font-semibold px-3 py-1 rounded-full">
                  Most popular
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold">{tier.name}</h2>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">{tier.price}</span>
                    {tier.period && (
                      <span className="text-muted-foreground text-sm">
                        {tier.period}
                      </span>
                    )}
                  </div>
                  {tier.name === "Pro" && (
                    <div className="text-xs text-muted-foreground mt-1">
                      or &pound;1,788/year (save &pound;600)
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{tier.description}</p>
                <ul className="space-y-2">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <span className="text-success mt-0.5">&#10003;</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA */}
              {cta.href === "#checkout" ? (
                <button
                  onClick={handleCheckout}
                  disabled={cta.disabled}
                  className={`w-full text-center px-5 py-3 rounded font-semibold text-sm transition-colors ${
                    "bg-brand text-white hover:bg-brand-hover"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {cta.label}
                </button>
              ) : (
                <a
                  href={cta.disabled ? undefined : cta.href}
                  className={`w-full text-center block px-5 py-3 rounded font-semibold text-sm transition-colors ${
                    tier.ctaStyle === "primary"
                      ? "bg-brand text-white hover:bg-brand-hover"
                      : tier.ctaStyle === "secondary"
                        ? "bg-foreground text-white hover:bg-[#333]"
                        : "border border-border text-foreground hover:bg-[#f5f5f5]"
                  } ${cta.disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}
                >
                  {cta.label}
                </a>
              )}
            </div>
          );
        })}
      </div>

      {/* Manage billing (Pro users) */}
      {currentPlan === "pro" && (
        <div className="text-center">
          <button
            onClick={async () => {
              try {
                const res = await fetch("/api/stripe/portal", { method: "POST" });
                const data = await res.json();
                if (data.url) window.location.href = data.url;
              } catch {
                alert("Could not open billing portal.");
              }
            }}
            className="text-sm text-brand underline hover:text-foreground transition-colors"
          >
            Manage billing &amp; subscription
          </button>
        </div>
      )}

      {/* Feature matrix */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-center">Compare plans</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-semibold">Feature</th>
                <th className="text-center py-3 px-4 font-semibold">Explorer</th>
                <th className="text-center py-3 px-4 font-semibold text-brand">
                  Pro
                </th>
                <th className="text-center py-3 px-4 font-semibold">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {featureMatrix.map((row) => (
                <tr key={row.feature} className="border-b border-border/30">
                  <td className="py-3 px-4 text-muted-foreground">{row.feature}</td>
                  <td className="py-3 px-4 text-center">{row.explorer}</td>
                  <td className="py-3 px-4 text-center font-medium">
                    {row.pro}
                  </td>
                  <td className="py-3 px-4 text-center">{row.enterprise}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Back link */}
      <div className="text-center text-sm text-muted-foreground">
        <a href="/dashboard" className="text-brand underline hover:text-foreground">
          Back to dashboard
        </a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page wrapper (Suspense for useSearchParams)
// ---------------------------------------------------------------------------

export default function UpgradePage() {
  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="max-w-5xl mx-auto p-12 text-center text-muted-foreground">
            Loading pricing...
          </div>
        }
      >
        <UpgradeContent />
      </Suspense>
    </AppShell>
  );
}
