"use client";

import Link from "next/link";
import AppShell from "@/components/AppShell";

const TEAL = "#0d9488";

export default function ProductAssurePage() {
  return (
    <AppShell>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `linear-gradient(180deg, ${TEAL}08 0%, transparent 100%)` }}
        />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-14 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium mb-6" style={{ backgroundColor: `${TEAL}15`, color: TEAL }}>
            Govern + Monitor
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            Verisum Assure
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Continuous alignment &amp; runtime governance.
            <br className="hidden sm:block" />
            Know when your governance posture drifts — before regulators do.
          </p>
          <div className="mt-6">
            <span className="text-3xl font-bold">£199</span>
            <span className="text-muted-foreground text-sm">/month</span>
            <span className="text-muted-foreground text-xs ml-2">or £1,788/year (save £600)</span>
          </div>
        </div>
      </section>

      {/* Everything in Core + */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="rounded-lg border border-border bg-brand/5 p-4 text-center text-sm">
          <span className="font-medium">Everything in</span>{" "}
          <Link href="/product/core" className="text-brand font-semibold hover:underline">Verisum Core</Link>
          <span className="font-medium">, plus continuous monitoring and team features.</span>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-12">
        <h2 className="text-2xl font-bold text-center">What Assure adds</h2>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Drift & Alerts */}
          <div className="border border-border rounded-xl p-7 space-y-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${TEAL}12`, color: TEAL }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold">Drift Detection &amp; Alerts</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Automatic comparison between consecutive assessments to detect governance
              regression. Get alerted when scores drop below your configured thresholds.
            </p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><span style={{ color: TEAL }}>&#10003;</span> Real-time drift detection</li>
              <li className="flex items-center gap-2"><span style={{ color: TEAL }}>&#10003;</span> Configurable threshold alerts</li>
              <li className="flex items-center gap-2"><span style={{ color: TEAL }}>&#10003;</span> Dimension-level drill-down</li>
            </ul>
          </div>

          {/* Escalations */}
          <div className="border border-border rounded-xl p-7 space-y-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${TEAL}12`, color: TEAL }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold">Escalation Workflows</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              When drift breaches a threshold, escalations auto-trigger with severity
              classification. Assign owners, track resolution, and maintain an audit trail.
            </p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><span style={{ color: TEAL }}>&#10003;</span> Auto-escalation on breach</li>
              <li className="flex items-center gap-2"><span style={{ color: TEAL }}>&#10003;</span> Severity classification (Low → Critical)</li>
              <li className="flex items-center gap-2"><span style={{ color: TEAL }}>&#10003;</span> Owner assignment + resolution tracking</li>
            </ul>
          </div>

          {/* System Assessments */}
          <div className="border border-border rounded-xl p-7 space-y-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${TEAL}12`, color: TEAL }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold">TrustSys — AI System Assessments</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Assess individual AI systems against a structured scoring framework.
              Evaluate risk, human oversight, data governance, and transparency at system level.
            </p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><span style={{ color: TEAL }}>&#10003;</span> 2 AI system assessments</li>
              <li className="flex items-center gap-2"><span style={{ color: TEAL }}>&#10003;</span> 5 TrustOrg assessments</li>
              <li className="flex items-center gap-2"><span style={{ color: TEAL }}>&#10003;</span> Historical tracking + trends</li>
            </ul>
          </div>

          {/* Team + Reporting */}
          <div className="border border-border rounded-xl p-7 space-y-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${TEAL}12`, color: TEAL }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold">Teams, Reports &amp; Copilot</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Invite team members, manage roles, and generate board-ready governance
              reports. Advanced AI policy generation and unlimited incident management.
            </p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><span style={{ color: TEAL }}>&#10003;</span> Team management (5 users)</li>
              <li className="flex items-center gap-2"><span style={{ color: TEAL }}>&#10003;</span> Staff Declarations (250 staff)</li>
              <li className="flex items-center gap-2"><span style={{ color: TEAL }}>&#10003;</span> CSV data export</li>
              <li className="flex items-center gap-2"><span style={{ color: TEAL }}>&#10003;</span> Priority support</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="border-t border-border bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8">
          <h2 className="text-2xl font-bold text-center">Who Assure is for</h2>
          <div className="grid sm:grid-cols-3 gap-6 text-center">
            {[
              { title: "Regulated industries", desc: "Financial services, healthcare, and public sector organisations that need continuous compliance evidence." },
              { title: "Multi-system deployments", desc: "Organisations running multiple AI systems that need system-level governance and cross-system visibility." },
              { title: "Growing teams", desc: "Companies scaling AI adoption that need role-based access, team management, and governance workflows." },
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
          background: `linear-gradient(180deg, var(--background) 0%, ${TEAL}06 100%)`,
        }}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Upgrade to continuous governance
          </h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Move beyond point-in-time assessments. Know your governance posture in real time.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="/upgrade"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full text-white font-semibold shadow-lg hover:-translate-y-0.5 transition-all duration-300"
              style={{ backgroundColor: TEAL }}
            >
              Upgrade to Assure
            </a>
            <a
              href="/product/verify"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full border border-border text-foreground font-semibold hover:bg-muted transition-all duration-300"
            >
              See Verisum Verify
            </a>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
