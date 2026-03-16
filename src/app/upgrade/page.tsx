"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/context/AuthContext";
import type { VersiumTier } from "@/lib/tiers";

// ---------------------------------------------------------------------------
// Plan data — 3 Verisum tiers
// ---------------------------------------------------------------------------

type PlanTier = {
  name: string;
  slug: "starter" | "pro" | "enterprise";
  tier: VersiumTier;
  tierTagline: string;
  price: string;
  period: string;
  yearlyNote?: string;
  description: string;
  sectionLabel: string;
  features: string[];
  bannerText?: string;
  bannerColor?: string;
  cta: string;
  ctaStyle: "primary" | "secondary" | "outline";
};

const tiers: PlanTier[] = [
  {
    name: "Verisum Core",
    slug: "starter",
    tier: "Core",
    tierTagline: "Governance Intelligence Foundation",
    price: "Free to try",
    period: "",
    yearlyNote: "then \u00a379/month or \u00a3711/year",
    description:
      "Get your AI governance sorted in 30 minutes. Start with a free self-assessment, then unlock the full governance suite.",
    sectionLabel: "Govern",
    features: [
      "Free self-assessment with instant results",
      "AI Governance Setup Wizard",
      "Governance Pack (3 PDF documents)",
      "1 TrustOrg assessment",
      "AI Policy Generator",
      "Staff Declaration Portal (50 staff)",
      "AI Vendor Register (10 vendors)",
      "Incident Logging (5/month)",
      "Regulatory Feed (UK/EU)",
    ],
    bannerText: "Most Popular For Startups",
    bannerColor: "brand",
    cta: "Start free",
    ctaStyle: "primary",
  },
  {
    name: "Verisum Assure",
    slug: "pro",
    tier: "Assure",
    tierTagline: "Continuous Alignment & Runtime Governance",
    price: "\u00a3199",
    period: "/month",
    yearlyNote: "or \u00a31,788/year (save \u00a3600)",
    description:
      "Full AI governance suite with continuous monitoring, escalation workflows, and board-ready reports.",
    sectionLabel: "Govern + Monitor",
    features: [
      "Everything in Core, plus:",
      "5 TrustOrg assessments",
      "2 AI system assessments (TrustSys)",
      "Drift detection & alerts",
      "Escalation workflows",
      "Incident management (unlimited)",
      "Runtime signals monitoring",
      "Team management (5 users)",
      "CSV data export",
      "Advanced policy generation",
      "Staff Declarations (250)",
      "Priority support",
    ],
    bannerText: "Advanced Governance",
    bannerColor: "teal",
    cta: "Upgrade to Assure",
    ctaStyle: "primary",
  },
  {
    name: "Verisum Verify",
    slug: "enterprise",
    tier: "Verify",
    tierTagline: "Cryptographic Proof & Trust Portability",
    price: "Custom",
    period: "",
    description:
      "For organisations that need cryptographic proof, unlimited capacity, and full API access.",
    sectionLabel: "Govern + Monitor + Prove",
    features: [
      "Everything in Assure, plus:",
      "Unlimited assessments",
      "Human-verified approvals",
      "Governance attestations",
      "Provenance certificates",
      "Incident lock & forensic freeze",
      "Cross-org trust exchange",
      "On-chain anchoring",
      "API access",
      "SSO / SAML",
      "Dedicated account manager",
    ],
    cta: "Contact us",
    ctaStyle: "secondary",
  },
];

// Feature comparison matrix — 3 columns grouped by workflow
type MatrixRow = {
  feature: string;
  core: string;
  assure: string;
  verify: string;
  section?: string; // section header label
};

const featureMatrix: MatrixRow[] = [
  // Govern
  { feature: "Self-assessment", core: "\u2713", assure: "\u2713", verify: "\u2713", section: "Govern" },
  { feature: "Governance Wizard + Pack", core: "\u2713", assure: "\u2713", verify: "\u2713" },
  { feature: "TrustOrg assessments", core: "1", assure: "5", verify: "Unlimited" },
  { feature: "TrustSys assessments", core: "\u2014", assure: "2", verify: "Unlimited" },
  { feature: "AI Policy Generator", core: "1 (auto)", assure: "Editable", verify: "Custom templates" },
  { feature: "Staff Declarations", core: "50 staff", assure: "250 staff", verify: "Unlimited" },
  { feature: "AI Vendor Register", core: "10", assure: "Unlimited", verify: "Unlimited + risk scoring" },
  { feature: "Incident Logging", core: "5/month", assure: "Unlimited", verify: "Unlimited + routing" },
  { feature: "Regulatory Feed", core: "UK/EU", assure: "UK/EU + sector", verify: "Custom jurisdictions" },
  // Monitor
  { feature: "Drift detection & alerts", core: "\u2014", assure: "\u2713", verify: "\u2713", section: "Monitor" },
  { feature: "Escalation workflows", core: "\u2014", assure: "\u2713", verify: "\u2713" },
  { feature: "Runtime signals", core: "\u2014", assure: "\u2713", verify: "\u2713" },
  { feature: "Team management", core: "\u2014", assure: "5 users", verify: "Unlimited" },
  { feature: "CSV export", core: "\u2014", assure: "\u2713", verify: "\u2713" },
  { feature: "Historical tracking", core: "\u2014", assure: "\u2713", verify: "\u2713" },
  // Prove
  { feature: "Human-verified approvals", core: "\u2014", assure: "\u2014", verify: "\u2713", section: "Prove" },
  { feature: "Governance attestations", core: "\u2014", assure: "\u2014", verify: "\u2713" },
  { feature: "Provenance certificates", core: "\u2014", assure: "\u2014", verify: "\u2713" },
  { feature: "Incident lock & forensic freeze", core: "\u2014", assure: "\u2014", verify: "\u2713" },
  { feature: "Cross-org trust exchange", core: "\u2014", assure: "\u2014", verify: "\u2713" },
  { feature: "On-chain anchoring", core: "\u2014", assure: "\u2014", verify: "\u2713" },
  { feature: "API access", core: "\u2014", assure: "\u2014", verify: "\u2713" },
  { feature: "SSO / SAML", core: "\u2014", assure: "\u2014", verify: "\u2713" },
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
  const highlightTier = searchParams.get("tier") as VersiumTier | null;

  function ctaFor(tier: PlanTier) {
    if (showLoading) {
      return { label: tier.cta, href: "#", disabled: true, checkoutPlan: null as string | null };
    }

    if (tier.slug === "starter") {
      if (!user) return { label: "Start free", href: "/try", disabled: false, checkoutPlan: null };
      if (currentPlan === "starter")
        return { label: "Current plan", href: "#", disabled: true, checkoutPlan: null };
      if (currentPlan === "pro" || currentPlan === "enterprise")
        return { label: "Current plan is higher", href: "#", disabled: true, checkoutPlan: null };
      return { label: "Upgrade to Core", href: "#checkout", disabled: false, checkoutPlan: "starter" };
    }

    if (tier.slug === "pro") {
      if (!user) return { label: "Sign in to upgrade", href: "/auth/login", disabled: false, checkoutPlan: null };
      if (currentPlan === "pro")
        return { label: "Current plan", href: "#", disabled: true, checkoutPlan: null };
      if (currentPlan === "enterprise")
        return { label: "Current plan is higher", href: "#", disabled: true, checkoutPlan: null };
      if (currentPlan === "starter")
        return { label: "Upgrade to Assure", href: "#portal", disabled: false, checkoutPlan: null };
      return { label: "Upgrade to Assure", href: "#checkout", disabled: false, checkoutPlan: "pro" };
    }

    // Verify (enterprise)
    return {
      label: "Contact us",
      href: "mailto:hello@verisum.org?subject=Verisum%20Verify%20enquiry",
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
    <div className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-12 space-y-12">
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
          Plans &amp; Pricing
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Choose the Verisum tier that matches your governance maturity. Start free, upgrade as you grow.
        </p>
      </div>

      {/* Pricing cards — 3 tiers */}
      <div className="grid md:grid-cols-3 gap-6">
        {tiers.map((tier) => {
          const cta = ctaFor(tier);
          const isBrand = tier.bannerColor === "brand";
          const isTeal = tier.bannerColor === "teal";
          const hasBanner = !!tier.bannerText;

          return (
            <div
              key={tier.name}
              className={`border rounded-xl p-6 flex flex-col justify-between space-y-6 ${
                hasBanner
                  ? isTeal
                    ? "border-teal-500 border-2 relative"
                    : "border-brand border-2 relative"
                  : highlightTier === tier.tier
                    ? "border-brand/50 border-2"
                    : "border-border"
              }`}
            >
              {hasBanner && (
                <div className={`absolute -top-3 left-1/2 -translate-x-1/2 text-white text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap ${
                  isTeal ? "bg-teal-500" : "bg-brand"
                }`}>
                  {tier.bannerText}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    isTeal ? "bg-teal-500/10 text-teal-600" : "bg-brand/10 text-brand"
                  }`}>
                    {tier.sectionLabel}
                  </span>
                  <h2 className="text-xl font-bold mt-2">{tier.name}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{tier.tierTagline}</p>
                  <div className="mt-3">
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

                {/* Features */}
                <ul className="space-y-2">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      {f.endsWith(":") ? (
                        <span className="text-muted-foreground font-medium">{f}</span>
                      ) : (
                        <>
                          <span className="text-success mt-0.5 shrink-0">&#10003;</span>
                          <span>{f}</span>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Learn more link */}
              <a
                href={`/product/${tier.slug === "starter" ? "core" : tier.slug === "pro" ? "assure" : "verify"}`}
                className={`text-sm font-medium hover:underline transition-colors ${
                  isTeal ? "text-teal-600" : isBrand ? "text-brand" : "text-foreground"
                }`}
              >
                Learn more &rarr;
              </a>

              {/* CTA */}
              {cta.href === "#checkout" && cta.checkoutPlan ? (
                <button
                  onClick={() => handleCheckout(cta.checkoutPlan as "starter" | "pro")}
                  disabled={cta.disabled}
                  className={`w-full text-center px-5 py-3 rounded-lg font-semibold text-sm transition-colors ${
                    isTeal
                      ? "bg-teal-500 text-white hover:bg-teal-600"
                      : "bg-brand text-white hover:bg-brand-hover"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {cta.label}
                </button>
              ) : cta.href === "#portal" ? (
                <button
                  onClick={handlePortal}
                  disabled={cta.disabled}
                  className={`w-full text-center px-5 py-3 rounded-lg font-semibold text-sm transition-colors ${
                    isTeal
                      ? "bg-teal-500 text-white hover:bg-teal-600"
                      : "bg-brand text-white hover:bg-brand-hover"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {cta.label}
                </button>
              ) : (
                <a
                  href={cta.disabled ? undefined : cta.href}
                  className={`w-full text-center block px-5 py-3 rounded-lg font-semibold text-sm transition-colors ${
                    tier.ctaStyle === "primary"
                      ? isTeal
                        ? "bg-teal-500 text-white hover:bg-teal-600"
                        : "bg-brand text-white hover:bg-brand-hover"
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

      {/* Feature comparison matrix */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-center">Compare tiers</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-semibold">Feature</th>
                <th className="text-center py-3 px-4">
                  <div className="font-semibold text-brand">Core</div>
                </th>
                <th className="text-center py-3 px-4">
                  <div className="font-semibold text-teal-600">Assure</div>
                </th>
                <th className="text-center py-3 px-4">
                  <div className="font-semibold">Verify</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {featureMatrix.map((row) => (
                <tr
                  key={row.feature}
                  className={`border-b border-border/30 ${
                    row.section ? "border-t-2 border-t-border" : ""
                  }`}
                >
                  <td className="py-3 px-4 text-muted-foreground">
                    {row.section && (
                      <span className="text-[10px] uppercase tracking-wide font-semibold text-brand block mb-1">
                        {row.section}
                      </span>
                    )}
                    {row.feature}
                  </td>
                  <td className="py-3 px-4 text-center">{row.core}</td>
                  <td className="py-3 px-4 text-center font-medium">{row.assure}</td>
                  <td className="py-3 px-4 text-center">{row.verify}</td>
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
