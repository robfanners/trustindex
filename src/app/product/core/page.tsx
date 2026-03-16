"use client";

import AppShell from "@/components/AppShell";

const BRAND = "#0066FF";

export default function ProductCorePage() {
  return (
    <AppShell>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-subtle to-transparent pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-14 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand/10 text-brand text-sm font-medium mb-6">
            Govern
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            Verisum Core
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            AI governance intelligence foundation.
            <br className="hidden sm:block" />
            Get your governance sorted in 30 minutes.
          </p>
          <div className="mt-6">
            <span className="text-3xl font-bold">Free to try</span>
            <span className="text-muted-foreground text-sm ml-2">then £79/month</span>
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-12">
        <h2 className="text-2xl font-bold text-center">What&apos;s included</h2>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Assessment */}
          <div className="border border-border rounded-xl p-7 space-y-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND}12`, color: BRAND }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold">Self-Assessment + TrustOrg</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Start with a free self-assessment to see your baseline score instantly.
              Then run a full organisational assessment with your team — scoring across
              transparency, inclusion, confidence, explainability, and governance dimensions.
            </p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><span style={{ color: BRAND }}>&#10003;</span> Free self-assessment (no account needed)</li>
              <li className="flex items-center gap-2"><span style={{ color: BRAND }}>&#10003;</span> 1 full TrustOrg assessment</li>
              <li className="flex items-center gap-2"><span style={{ color: BRAND }}>&#10003;</span> Instant radar charts + dimension scores</li>
            </ul>
          </div>

          {/* Governance Pack */}
          <div className="border border-border rounded-xl p-7 space-y-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND}12`, color: BRAND }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold">AI Governance Setup Wizard</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Walk through a guided setup that produces your governance foundation:
              auto-generated AI policy, staff declaration portal, and vendor register.
              Output a 3-document governance pack in PDF.
            </p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><span style={{ color: BRAND }}>&#10003;</span> AI Policy Generator</li>
              <li className="flex items-center gap-2"><span style={{ color: BRAND }}>&#10003;</span> Governance Pack (3 PDF documents)</li>
              <li className="flex items-center gap-2"><span style={{ color: BRAND }}>&#10003;</span> Staff Declaration Portal (50 staff)</li>
            </ul>
          </div>

          {/* Vendor Register */}
          <div className="border border-border rounded-xl p-7 space-y-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND}12`, color: BRAND }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold">AI Vendor Register</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Track every AI tool and vendor your organisation uses.
              Log risk levels, data categories, and contractual safeguards in one place.
            </p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><span style={{ color: BRAND }}>&#10003;</span> 10 vendor slots</li>
              <li className="flex items-center gap-2"><span style={{ color: BRAND }}>&#10003;</span> Risk classification</li>
              <li className="flex items-center gap-2"><span style={{ color: BRAND }}>&#10003;</span> Incident logging (5/month)</li>
            </ul>
          </div>

          {/* Regulatory Feed */}
          <div className="border border-border rounded-xl p-7 space-y-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND}12`, color: BRAND }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold">Regulatory Feed</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Stay current with AI regulation changes. Curated updates
              from the EU AI Act, UK AI Code of Practice, and related frameworks
              — delivered to your dashboard.
            </p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><span style={{ color: BRAND }}>&#10003;</span> UK + EU coverage</li>
              <li className="flex items-center gap-2"><span style={{ color: BRAND }}>&#10003;</span> Impact assessments</li>
              <li className="flex items-center gap-2"><span style={{ color: BRAND }}>&#10003;</span> In-app notifications</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="border-t border-border bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8">
          <h2 className="text-2xl font-bold text-center">Who Core is for</h2>
          <div className="grid sm:grid-cols-3 gap-6 text-center">
            {[
              { title: "Startups using AI", desc: "You know you need governance but don't know where to start. Core gets you from zero to documented in a single session." },
              { title: "Scale-ups before audit", desc: "Investors or partners are asking about AI governance. Core gives you the documentation and scores to show." },
              { title: "Teams exploring AI", desc: "You're piloting AI tools and need a lightweight way to track what's being used and by whom." },
            ].map((item) => (
              <div key={item.title} className="space-y-2">
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        className="border-t border-border"
        style={{
          background: "linear-gradient(180deg, var(--background) 0%, rgba(0,102,255,0.04) 100%)",
        }}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Start your governance foundation
          </h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Try a free self-assessment — no account needed. Then upgrade to Core
            for the full governance suite.
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
