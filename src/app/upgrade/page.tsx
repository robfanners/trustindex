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
  slug: "explorer" | "starter" | "pro" | "enterprise";
  price: string;
  period: string;
  yearlyNote?: string;
  description: string;
  features: string[];
  copilotFeatures: { label: string; available: boolean }[];
  highlighted?: boolean;
  cta: string;
  ctaStyle: "primary" | "secondary" | "outline";
};

const tiers: PlanTier[] = [
  {
    name: "Explorer",
    slug: "explorer",
    price: "Free",
    period: "",
    description:
      "Try a private self-assessment to see how trust is experienced in your organisation.",
    features: [
      "1 self-assessment",
      "Instant results with radar chart",
      "Band interpretation and actions",
      "No sign-up required to start",
    ],
    copilotFeatures: [
      { label: "AI Policy Generator", available: false },
      { label: "Staff Declaration Portal", available: false },
      { label: "AI Vendor Register", available: false },
      { label: "Monthly Compliance PDF", available: false },
      { label: "Incident Logging", available: false },
      { label: "Regulatory Feed", available: false },
    ],
    cta: "Get started free",
    ctaStyle: "outline",
  },
  {
    name: "Starter",
    slug: "starter",
    price: "\u00a379",
    period: "/month",
    yearlyNote: "or \u00a3711/year (save \u00a3237)",
    description:
      "Get your AI governance sorted in 30 minutes. Guided setup, instant governance pack, ongoing compliance tools.",
    features: [
      "AI Governance Setup Wizard",
      "Governance Pack (3 PDF documents)",
      "Instant gap analysis & recommendations",
      "1 org assessment (TrustOrg)",
    ],
    copilotFeatures: [
      { label: "AI Policy Generator (1 auto-generated)", available: true },
      { label: "Staff Declaration Portal (50 staff)", available: true },
      { label: "AI Vendor Register (10 vendors)", available: true },
      { label: "Monthly Compliance PDF (basic)", available: true },
      { label: "Incident Logging (5/month)", available: true },
      { label: "Regulatory Feed (UK/EU)", available: true },
    ],
    highlighted: true,
    cta: "Get started",
    ctaStyle: "primary",
  },
  {
    name: "Pro",
    slug: "pro",
    price: "\u00a3199",
    period: "/month",
    yearlyNote: "or \u00a31,788/year (save \u00a3600)",
    description:
      "Full AI governance suite with system assessments, editable policies, and board-ready reports.",
    features: [
      "Everything in Starter, plus:",
      "5 org assessments (TrustOrg)",
      "2 AI system assessments",
      "Basic team management (up to 5 users)",
      "CSV data export",
      "Historical tracking",
      "Dimension-level insights",
      "Priority support",
    ],
    copilotFeatures: [
      { label: "AI Policy Generator (editable)", available: true },
      { label: "Staff Declaration Portal (250 staff)", available: true },
      { label: "AI Vendor Register (unlimited)", available: true },
      { label: "Monthly Compliance PDF (full board report)", available: true },
      { label: "Incident Logging (unlimited)", available: true },
      { label: "Regulatory Feed (UK/EU + sector)", available: true },
    ],
    cta: "Upgrade to Pro",
    ctaStyle: "outline",
  },
  {
    name: "Enterprise",
    slug: "enterprise",
    price: "Custom",
    period: "",
    description:
      "For organisations that need unlimited capacity, governance tooling, and API access.",
    features: [
      "Unlimited org assessments",
      "Unlimited system assessments",
      "Full CSV export",
      "Historical tracking",
      "Governance & audit trail",
      "API access",
      "SSO / SAML",
      "Dedicated account manager",
    ],
    copilotFeatures: [
      { label: "AI Policy Generator (custom templates)", available: true },
      { label: "Staff Declaration Portal (unlimited + SSO)", available: true },
      { label: "AI Vendor Register (+ risk scoring)", available: true },
      { label: "Monthly Compliance PDF (custom branding)", available: true },
      { label: "Incident Logging (+ workflow routing)", available: true },
      { label: "Regulatory Feed (custom jurisdictions)", available: true },
    ],
    cta: "Contact us",
    ctaStyle: "secondary",
  },
];

// Feature comparison matrix
type MatrixRow = {
  feature: string;
  explorer: string;
  starter: string;
  pro: string;
  enterprise: string;
  isCopilot?: boolean;
};

const featureMatrix: MatrixRow[] = [
  { feature: "Governance Wizard + Pack", explorer: "\u2014", starter: "\u2713", pro: "\u2713", enterprise: "\u2713" },
  { feature: "Org assessments", explorer: "Self", starter: "1", pro: "5", enterprise: "Unlimited" },
  { feature: "System assessments", explorer: "\u2014", starter: "\u2014", pro: "2", enterprise: "Unlimited" },
  { feature: "CSV export", explorer: "\u2014", starter: "\u2014", pro: "\u2713", enterprise: "\u2713" },
  { feature: "Historical tracking", explorer: "\u2014", starter: "\u2014", pro: "\u2713", enterprise: "\u2713" },
  { feature: "AI Policy Generator", explorer: "\u2014", starter: "1 (auto)", pro: "Editable", enterprise: "Custom", isCopilot: true },
  { feature: "Staff Declarations", explorer: "\u2014", starter: "50 staff", pro: "250 staff", enterprise: "Unlimited", isCopilot: true },
  { feature: "AI Vendor Register", explorer: "\u2014", starter: "10", pro: "Unlimited", enterprise: "Unlimited", isCopilot: true },
  { feature: "Monthly Compliance PDF", explorer: "\u2014", starter: "Basic", pro: "Full report", enterprise: "Custom", isCopilot: true },
  { feature: "Incident Logging", explorer: "\u2014", starter: "5/month", pro: "Unlimited", enterprise: "Unlimited", isCopilot: true },
  { feature: "Regulatory Feed", explorer: "\u2014", starter: "UK/EU", pro: "UK/EU + sector", enterprise: "Custom", isCopilot: true },
  { feature: "Team management", explorer: "\u2014", starter: "\u2014", pro: "5 users", enterprise: "Unlimited" },
  { feature: "API access", explorer: "\u2014", starter: "\u2014", pro: "\u2014", enterprise: "\u2713" },
  { feature: "SSO / SAML", explorer: "\u2014", starter: "\u2014", pro: "\u2014", enterprise: "\u2713" },
];

// ---------------------------------------------------------------------------
// Inner content (uses useSearchParams, needs Suspense)
// ---------------------------------------------------------------------------

function UpgradeContent() {
  const searchParams = useSearchParams();
  const { user, profile, loading: authLoading } = useAuth();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const showLoading = !mounted || authLoading;

  const success = searchParams.get("success") === "true";
  const cancelled = searchParams.get("cancelled") === "true";
  const currentPlan = profile?.plan ?? null;

  function ctaFor(tier: PlanTier) {
    if (showLoading) {
      return { label: tier.cta, href: "#", disabled: true, checkoutPlan: null as string | null };
    }

    if (tier.slug === "explorer") {
      if (!user) return { label: "Try free", href: "/try", disabled: false, checkoutPlan: null };
      if (currentPlan === "explorer")
        return { label: "Current plan", href: "#", disabled: true, checkoutPlan: null };
      return { label: "Explorer", href: "/dashboard", disabled: true, checkoutPlan: null };
    }

    if (tier.slug === "starter") {
      if (!user) return { label: "Sign in to upgrade", href: "/auth/login", disabled: false, checkoutPlan: null };
      if (currentPlan === "starter")
        return { label: "Current plan", href: "#", disabled: true, checkoutPlan: null };
      if (currentPlan === "pro" || currentPlan === "enterprise")
        return { label: "Current plan is higher", href: "#", disabled: true, checkoutPlan: null };
      return { label: "Start with Starter", href: "#checkout", disabled: false, checkoutPlan: "starter" };
    }

    if (tier.slug === "pro") {
      if (!user) return { label: "Sign in to upgrade", href: "/auth/login", disabled: false, checkoutPlan: null };
      if (currentPlan === "pro")
        return { label: "Current plan", href: "#", disabled: true, checkoutPlan: null };
      if (currentPlan === "enterprise")
        return { label: "Current plan is higher", href: "#", disabled: true, checkoutPlan: null };
      if (currentPlan === "starter")
        return { label: "Upgrade to Pro", href: "#portal", disabled: false, checkoutPlan: null };
      return { label: "Upgrade to Pro", href: "#checkout", disabled: false, checkoutPlan: "pro" };
    }

    // Enterprise
    return {
      label: "Contact us",
      href: "mailto:hello@verisum.org?subject=TrustGraph%20Enterprise%20enquiry",
      disabled: false,
      checkoutPlan: null,
    };
  }

  async function handleCheckout(plan: "starter" | "pro") {
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval: "monthly" }),
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

  async function handlePortal() {
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      alert("Could not open billing portal.");
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-12 space-y-12">
      {/* Success / cancelled banners */}
      {success && (
        <div className="border border-success rounded-lg p-4 bg-green-50 text-sm">
          <span className="font-semibold text-success">
            Payment successful.
          </span>{" "}
          Your plan has been upgraded. It may take a moment to reflect in
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
          AI governance sorted in 48 hours. Start free, upgrade when you need
          policies, declarations, and compliance reporting.
        </p>
      </div>

      {/* Pricing cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                  {tier.yearlyNote && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {tier.yearlyNote}
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{tier.description}</p>

                {/* Core features */}
                <ul className="space-y-2">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <span className="text-success mt-0.5">&#10003;</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {/* Copilot features */}
                {tier.copilotFeatures.length > 0 && (
                  <>
                    <div className="border-t border-border/30 pt-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        AI Governance Copilot
                      </p>
                      <ul className="space-y-2">
                        {tier.copilotFeatures.map((f) => (
                          <li
                            key={f.label}
                            className={`flex items-start gap-2 text-sm ${
                              f.available ? "" : "text-muted-foreground/50"
                            }`}
                          >
                            {f.available ? (
                              <span className="text-success mt-0.5">&#10003;</span>
                            ) : (
                              <span className="mt-0.5">&#128274;</span>
                            )}
                            <span>{f.available ? f.label : f.label}</span>
                          </li>
                        ))}
                      </ul>
                      {tier.slug === "explorer" && (
                        <p className="text-xs text-brand mt-2 font-medium">
                          Upgrade to unlock Copilot features &rarr;
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* CTA */}
              {cta.href === "#checkout" && cta.checkoutPlan ? (
                <button
                  onClick={() => handleCheckout(cta.checkoutPlan as "starter" | "pro")}
                  disabled={cta.disabled}
                  className={`w-full text-center px-5 py-3 rounded font-semibold text-sm transition-colors ${
                    tier.ctaStyle === "primary"
                      ? "bg-brand text-white hover:bg-brand-hover"
                      : "border border-brand text-brand hover:bg-brand hover:text-white"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {cta.label}
                </button>
              ) : cta.href === "#portal" ? (
                <button
                  onClick={handlePortal}
                  disabled={cta.disabled}
                  className="w-full text-center px-5 py-3 rounded font-semibold text-sm transition-colors bg-brand text-white hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Manage billing (paid users) */}
      {(currentPlan === "starter" || currentPlan === "pro") && (
        <div className="text-center">
          <button
            onClick={handlePortal}
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
                <th className="text-center py-3 px-4 font-semibold">Starter</th>
                <th className="text-center py-3 px-4 font-semibold text-brand">
                  Pro
                </th>
                <th className="text-center py-3 px-4 font-semibold">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {featureMatrix.map((row, i) => (
                <tr
                  key={row.feature}
                  className={`border-b border-border/30 ${
                    row.isCopilot && i === featureMatrix.findIndex((r) => r.isCopilot)
                      ? "border-t-2 border-t-border"
                      : ""
                  }`}
                >
                  <td className="py-3 px-4 text-muted-foreground">
                    {row.isCopilot && i === featureMatrix.findIndex((r) => r.isCopilot) && (
                      <span className="text-[10px] uppercase tracking-wide font-semibold text-brand block mb-1">
                        Copilot
                      </span>
                    )}
                    {row.feature}
                  </td>
                  <td className="py-3 px-4 text-center">{row.explorer}</td>
                  <td className="py-3 px-4 text-center">{row.starter}</td>
                  <td className="py-3 px-4 text-center font-medium">{row.pro}</td>
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
          <div className="max-w-6xl mx-auto p-12 text-center text-muted-foreground">
            Loading pricing...
          </div>
        }
      >
        <UpgradeContent />
      </Suspense>
    </AppShell>
  );
}
