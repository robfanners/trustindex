"use client";

import AppShell from "@/components/AppShell";

const CORAL = "#e8614d";
const TEAL = "#0d9488";

export default function ProductVerifyPage() {
  return (
    <AppShell>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `linear-gradient(180deg, ${CORAL}08 0%, transparent 100%)` }}
        />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-14 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium mb-6" style={{ backgroundColor: `${CORAL}15`, color: CORAL }}>
            Govern + Monitor + Prove
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            Verisum Verify
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Cryptographic proof &amp; trust portability.
            <br className="hidden sm:block" />
            Governance you can prove to anyone, anywhere.
          </p>
          <div className="mt-6">
            <span className="text-3xl font-bold">Custom</span>
            <span className="text-muted-foreground text-sm ml-2">pricing for enterprise</span>
          </div>
        </div>
      </section>

      {/* Everything in Assure + */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="rounded-lg border border-border p-4 text-center text-sm" style={{ backgroundColor: `${TEAL}08` }}>
          <span className="font-medium">Everything in</span>{" "}
          <a href="/product/assure" className="font-semibold hover:underline" style={{ color: TEAL }}>Verisum Assure</a>
          <span className="font-medium">, plus cryptographic proof and unlimited capacity.</span>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-12">
        <h2 className="text-2xl font-bold text-center">What Verify adds</h2>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Approvals */}
          <div className="border border-border rounded-xl p-7 space-y-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${CORAL}12`, color: CORAL }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold">Human-Verified Approvals</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Named individuals review and approve governance records before they
              become attestations. Creates a chain of accountability with who approved
              what, and when.
            </p>
          </div>

          {/* Attestations */}
          <div className="border border-border rounded-xl p-7 space-y-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${CORAL}12`, color: CORAL }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold">Governance Attestations</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Cryptographically signed statements attesting to the governance state of
              your organisation or a specific AI system at a point in time. Powered by
              the HAPP protocol.
            </p>
          </div>

          {/* Provenance */}
          <div className="border border-border rounded-xl p-7 space-y-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${CORAL}12`, color: CORAL }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold">Provenance Certificates</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Generate shareable certificates that prove a governance event occurred.
              Each certificate has a unique verification link that anyone can check
              independently.
            </p>
          </div>

          {/* Incident Lock */}
          <div className="border border-border rounded-xl p-7 space-y-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${CORAL}12`, color: CORAL }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold">Incident Lock &amp; Forensic Freeze</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              When an AI incident occurs, capture and freeze the complete governance
              state at that moment. Prevents post-hoc alteration and provides forensic
              evidence for investigations.
            </p>
          </div>

          {/* Trust Exchange */}
          <div className="border border-border rounded-xl p-7 space-y-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${CORAL}12`, color: CORAL }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold">Cross-Org Trust Exchange</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Share governance evidence with supply chain partners, clients, or
              regulators — without exposing your internal governance data. They see
              attestation status, not your raw scores.
            </p>
          </div>

          {/* On-chain */}
          <div className="border border-border rounded-xl p-7 space-y-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${CORAL}12`, color: CORAL }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold">On-Chain Anchoring</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Attestation hashes are anchored on-chain, creating an immutable
              timestamp that proves the governance record existed at a specific point
              in time. Tamper-proof by design.
            </p>
          </div>
        </div>

        {/* Additional enterprise features */}
        <div className="border border-border rounded-xl p-7 space-y-4">
          <h3 className="text-lg font-semibold text-center">Enterprise features</h3>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {[
              { title: "Unlimited assessments", desc: "TrustOrg + TrustSys" },
              { title: "API access", desc: "Full REST API" },
              { title: "SSO / SAML", desc: "Enterprise identity" },
              { title: "Dedicated account manager", desc: "Named contact" },
            ].map((f) => (
              <div key={f.title} className="space-y-1">
                <p className="text-sm font-semibold">{f.title}</p>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HAPP callout */}
      <section className="border-t border-border bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center space-y-4">
          <h2 className="text-2xl font-bold">Powered by the HAPP Protocol</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            The Human-Attested Provenance Protocol is the cryptographic evidence layer
            inside Verisum Verify. It turns governance actions into tamper-proof,
            verifiable records.
          </p>
          <a
            href="/protocol"
            className="inline-flex items-center gap-1 text-sm font-semibold hover:underline"
            style={{ color: CORAL }}
          >
            Learn about the HAPP Protocol
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
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
            Ready for verifiable AI governance?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Verisum Verify is for organisations that need cryptographic proof,
            unlimited capacity, and enterprise integration.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="mailto:hello@verisum.org?subject=Verisum%20Verify%20enquiry"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full text-white font-semibold shadow-lg hover:-translate-y-0.5 transition-all duration-300"
              style={{ backgroundColor: CORAL }}
            >
              Contact Us
            </a>
            <a
              href="/upgrade"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full border border-border text-foreground font-semibold hover:bg-muted transition-all duration-300"
            >
              Compare All Tiers
            </a>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
