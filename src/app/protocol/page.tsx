"use client";

import AppShell from "@/components/AppShell";

const CORAL = "#e8614d";
const TEAL = "#0d9488";
const BRAND = "#0066FF";

export default function ProtocolPage() {
  return (
    <AppShell>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(180deg, ${CORAL}08 0%, transparent 100%)`,
          }}
        />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-14 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-coral-light text-sm font-medium mb-6" style={{ color: CORAL }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Verisum Verify
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            The HAPP Protocol
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Human-Attested Provenance Protocol.
            <br className="hidden sm:block" />
            Cryptographic proof that governance happened — not just that a policy exists.
          </p>
        </div>
      </section>

      {/* What is HAPP */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="rounded-xl border border-border p-8 md:p-10 space-y-6">
          <h2 className="text-2xl font-bold">What is HAPP?</h2>
          <p className="text-muted-foreground leading-relaxed">
            HAPP is the cryptographic evidence layer inside Verisum Verify. It turns
            governance actions — assessments, approvals, declarations, incident
            responses — into tamper-proof, timestamped records that can be
            independently verified by anyone with a link.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Unlike PDF certificates or self-declared compliance badges, HAPP
            evidence is anchored on-chain and cryptographically signed. If anyone
            alters the underlying governance data, the verification fails.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-muted/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
          <h2 className="text-2xl font-bold text-center">How HAPP works</h2>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              {
                step: "1",
                title: "Govern",
                desc: "Assessments, policies, and declarations are captured in Verisum as structured governance events.",
                color: BRAND,
              },
              {
                step: "2",
                title: "Attest",
                desc: "A human approver reviews the governance record and signs an attestation confirming accuracy.",
                color: TEAL,
              },
              {
                step: "3",
                title: "Anchor",
                desc: "The attestation hash is anchored on-chain, creating an immutable timestamp and integrity proof.",
                color: CORAL,
              },
              {
                step: "4",
                title: "Verify",
                desc: "Anyone with the verification link can independently confirm the governance record is authentic and unaltered.",
                color: CORAL,
              },
            ].map((s) => (
              <div key={s.step} className="text-center space-y-3">
                <span
                  className="inline-flex items-center justify-center w-10 h-10 rounded-full text-white text-sm font-bold shadow-lg mx-auto"
                  style={{ backgroundColor: s.color }}
                >
                  {s.step}
                </span>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>

          {/* Flow connector */}
          <div className="hidden md:flex items-center justify-center -mt-4">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: BRAND }} />
              <div className="w-12 h-0.5" style={{ background: `linear-gradient(90deg, ${BRAND}, ${TEAL})` }} />
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: TEAL }} />
              <div className="w-12 h-0.5" style={{ background: `linear-gradient(90deg, ${TEAL}, ${CORAL})` }} />
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CORAL }} />
              <div className="w-12 h-0.5" style={{ backgroundColor: CORAL }} />
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CORAL }} />
            </div>
          </div>
        </div>
      </section>

      {/* What gets proven */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8">
        <h2 className="text-2xl font-bold text-center">What can be proven</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
          {[
            { title: "Governance Assessments", desc: "Org-level and system-level assessment scores, dimension breakdowns, and maturity classifications." },
            { title: "Policy Approvals", desc: "That a specific AI policy was reviewed, approved, and published by an authorised person on a specific date." },
            { title: "Staff Declarations", desc: "That staff members completed AI usage declarations within a given compliance window." },
            { title: "Incident Responses", desc: "That an AI incident was logged, investigated, and resolved according to your governance process." },
            { title: "Vendor Due Diligence", desc: "That AI vendor assessments were conducted with specific risk ratings and mitigation actions." },
            { title: "Regulatory Alignment", desc: "That your governance posture was assessed against specific regulatory frameworks at a point in time." },
          ].map((item) => (
            <div key={item.title} className="border border-border rounded-lg p-5 space-y-2">
              <h3 className="font-semibold text-sm">{item.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why it matters */}
      <section className="border-t border-border bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8">
          <h2 className="text-2xl font-bold text-center">Why cryptographic proof matters</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {[
              { title: "Regulators want evidence, not promises", desc: "The EU AI Act requires documented governance. HAPP provides verifiable proof that governance actions occurred as declared." },
              { title: "Boards need accountability signals", desc: "Governance attestations create an auditable trail of who approved what, when, and what the governance posture was at that point." },
              { title: "Partners need trust portability", desc: "Cross-org trust exchange lets you share governance evidence with supply chain partners without exposing internal data." },
              { title: "Incidents need forensic freeze", desc: "When something goes wrong, incident lock captures the governance state at the moment of the incident — before anyone can alter records." },
            ].map((item) => (
              <div key={item.title} className="space-y-2">
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        className="border-t border-border"
        style={{
          background: `linear-gradient(180deg, var(--background) 0%, ${CORAL}06 100%)`,
        }}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Ready for verifiable governance?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            HAPP is available on Verisum Verify. Contact us to discuss your needs.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="mailto:hello@verisum.org?subject=Verisum%20Verify%20%2B%20HAPP%20enquiry"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full text-white font-semibold shadow-lg hover:-translate-y-0.5 transition-all duration-300"
              style={{ backgroundColor: CORAL }}
            >
              Contact Us About Verify
            </a>
            <a
              href="/product/verify"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full border border-border text-foreground font-semibold hover:bg-muted transition-all duration-300"
            >
              Learn About Verisum Verify
            </a>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
