"use client";

import AppShell from "@/components/AppShell";
import Image from "next/image";

/* ------------------------------------------------------------------ */
/*  Screenshot placeholder — swap for real <Image> once assets exist  */
/* ------------------------------------------------------------------ */
function ScreenshotPlaceholder({
  label,
  annotations,
  accentColor,
}: {
  label: string;
  annotations: string[];
  accentColor: string;
}) {
  return (
    <div className="relative rounded-xl border border-border bg-muted/40 shadow-sm overflow-hidden">
      {/* Simulated browser chrome */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 bg-muted/60 border-b border-border">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
        <span className="ml-3 text-[11px] text-muted-foreground font-mono truncate">
          app.verisum.org
        </span>
      </div>

      {/* Placeholder body */}
      <div className="aspect-[16/10] flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div
            className="w-10 h-10 rounded-lg mx-auto flex items-center justify-center"
            style={{ backgroundColor: `${accentColor}18` }}
          >
            <svg
              className="w-5 h-5"
              style={{ color: accentColor }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
        </div>
      </div>

      {/* Annotation chips */}
      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-1.5">
        {annotations.map((a) => (
          <span
            key={a}
            className="text-[11px] font-medium px-2.5 py-1 rounded-full text-white shadow-sm"
            style={{ backgroundColor: accentColor }}
          >
            {a}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step number badge                                                  */
/* ------------------------------------------------------------------ */
function StepBadge({
  step,
  color,
}: {
  step: number;
  color: string;
}) {
  return (
    <span
      className="inline-flex items-center justify-center w-10 h-10 rounded-full text-white text-sm font-bold shadow-lg shrink-0"
      style={{ backgroundColor: color }}
    >
      {step}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Connector line between steps                                       */
/* ------------------------------------------------------------------ */
function StepConnector({ from, to }: { from: string; to: string }) {
  return (
    <div className="flex items-center justify-center py-4 md:py-6">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: from }} />
        <div
          className="w-16 h-0.5 rounded-full"
          style={{
            background: `linear-gradient(90deg, ${from}, ${to})`,
          }}
        />
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: to }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

const BRAND = "#0066FF";
const TEAL = "#0d9488";
const CORAL = "#e8614d";

export default function HowItWorksPage() {
  return (
    <AppShell>
      {/* ---- Hero ---- */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-subtle to-transparent pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-14 text-center">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            How Verisum Works
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Three stages. One platform.
            <br className="hidden sm:block" />
            Governance you can prove.
          </p>
        </div>
      </section>

      {/* ---- Steps ---- */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        {/* ---- Step 1: Govern ---- */}
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
          {/* Text */}
          <div className="order-2 md:order-1">
            <div className="flex items-center gap-3 mb-4">
              <StepBadge step={1} color={BRAND} />
              <h2 className="text-2xl md:text-3xl font-bold">Govern</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Assess your organisational AI governance posture and every AI
              system you operate. Verisum scores your maturity across key
              dimensions and generates a governance pack automatically.
            </p>
            <ul className="space-y-2">
              {[
                "Run your first assessment in under 10 minutes",
                "Auto-generated governance pack",
                "Maturity scores across key dimensions",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <svg
                    className="w-4 h-4 mt-0.5 shrink-0"
                    style={{ color: BRAND }}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Screenshots */}
          <div className="order-1 md:order-2 space-y-4">
            <ScreenshotPlaceholder
              label="Dashboard with health score"
              annotations={["Run your first assessment in under 10 minutes"]}
              accentColor={BRAND}
            />
            <ScreenshotPlaceholder
              label="TrustOrg survey results"
              annotations={["Auto-generated governance pack"]}
              accentColor={BRAND}
            />
          </div>
        </div>

        {/* Connector 1→2 */}
        <StepConnector from={BRAND} to={TEAL} />

        {/* ---- Step 2: Monitor ---- */}
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
          {/* Screenshots (left on desktop) */}
          <div className="space-y-4">
            <ScreenshotPlaceholder
              label="Drift & Alerts with events"
              annotations={["Real-time drift detection"]}
              accentColor={TEAL}
            />
            <ScreenshotPlaceholder
              label="Escalations detail panel"
              annotations={["Auto-escalation on threshold breach"]}
              accentColor={TEAL}
            />
          </div>

          {/* Text (right on desktop) */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <StepBadge step={2} color={TEAL} />
              <h2 className="text-2xl md:text-3xl font-bold">Monitor</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Continuously track whether reality matches your declared governance
              intent. Drift detection spots regression, and escalations
              auto-trigger when thresholds are breached.
            </p>
            <ul className="space-y-2">
              {[
                "Real-time drift detection",
                "Auto-escalation on threshold breach",
                "Incident capture & staff declarations",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <svg
                    className="w-4 h-4 mt-0.5 shrink-0"
                    style={{ color: TEAL }}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Connector 2→3 */}
        <StepConnector from={TEAL} to={CORAL} />

        {/* ---- Step 3: Prove ---- */}
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
          {/* Text */}
          <div className="order-2 md:order-1">
            <div className="flex items-center gap-3 mb-4">
              <StepBadge step={3} color={CORAL} />
              <h2 className="text-2xl md:text-3xl font-bold">Prove</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Generate tamper-proof governance evidence. Cryptographically signed
              attestations give regulators, partners, and boards verifiable proof
              that governance occurred as declared.
            </p>
            <ul className="space-y-2">
              {[
                "Tamper-proof governance evidence",
                "Share verifiable proof with regulators",
                "Cryptographic chain anchoring",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <svg
                    className="w-4 h-4 mt-0.5 shrink-0"
                    style={{ color: CORAL }}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Screenshots */}
          <div className="order-1 md:order-2 space-y-4">
            <ScreenshotPlaceholder
              label="Approvals list"
              annotations={["Tamper-proof governance evidence"]}
              accentColor={CORAL}
            />
            <ScreenshotPlaceholder
              label="Attestation with chain status"
              annotations={["Share verifiable proof with regulators"]}
              accentColor={CORAL}
            />
          </div>
        </div>
      </section>

      {/* ---- CTA ---- */}
      <section
        className="border-t border-border"
        style={{
          background:
            "linear-gradient(180deg, var(--background) 0%, rgba(0,102,255,0.04) 100%)",
        }}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Start Your Governance Journey
          </h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            See where your organisation stands in under 10 minutes — no account
            required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="/try"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-brand text-white font-semibold shadow-lg shadow-brand/20 hover:bg-brand-hover hover:-translate-y-0.5 hover:shadow-brand/30 transition-all duration-300"
            >
              Try Free Assessment
            </a>
            <a
              href="/upgrade"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full border border-border text-foreground font-semibold hover:bg-muted transition-all duration-300"
            >
              View Pricing
            </a>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
