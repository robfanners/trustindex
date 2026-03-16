"use client";

import AppShell from "@/components/AppShell";

const BRAND = "#0066FF";
const TEAL = "#0d9488";
const CORAL = "#e8614d";

type Service = {
  title: string;
  tagline: string;
  description: string;
  deliverables: string[];
  color: string;
  icon: React.ReactNode;
};

const services: Service[] = [
  {
    title: "AI Governance Readiness Assessment",
    tagline: "Know where you stand in 2 weeks",
    description:
      "A structured engagement to baseline your organisation's AI governance posture. We run Verisum assessments across your teams, interview key stakeholders, and deliver a prioritised roadmap.",
    deliverables: [
      "Full TrustOrg assessment across leadership + teams",
      "TrustSys assessment of up to 3 AI systems",
      "Gap analysis against EU AI Act / UK AI Code",
      "Prioritised 90-day governance roadmap",
      "Executive summary presentation",
    ],
    color: BRAND,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "Continuous Governance Programme",
    tagline: "Ongoing monitoring, quarterly reviews",
    description:
      "For organisations that want a governance partner, not just a tool. We manage your Verisum instance, run quarterly reassessments, and keep your governance posture aligned with evolving regulation.",
    deliverables: [
      "Dedicated governance analyst",
      "Quarterly reassessments + trend reporting",
      "Drift monitoring + escalation management",
      "Regulatory change impact briefings",
      "Board-ready governance reports",
      "Staff declaration programme management",
    ],
    color: TEAL,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
  },
  {
    title: "AI Policy & Compliance Pack",
    tagline: "Publication-ready governance documentation",
    description:
      "We produce your complete AI governance documentation suite — policies, risk registers, impact assessments, and staff-facing materials — all grounded in your actual Verisum assessment data.",
    deliverables: [
      "AI Governance Policy (board-approved format)",
      "AI Risk Register with scoring",
      "Data Protection Impact Assessments (AI-specific)",
      "Staff AI Acceptable Use Policy",
      "Vendor AI Due Diligence Framework",
      "Regulatory compliance mapping (EU AI Act / UK)",
    ],
    color: BRAND,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    title: "Cryptographic Proof & Attestation Setup",
    tagline: "Verifiable governance for regulated industries",
    description:
      "We configure and deploy Verisum Verify's cryptographic proof layer for your organisation — on-chain anchoring, attestation workflows, and cross-org trust exchange setup.",
    deliverables: [
      "Attestation workflow design + deployment",
      "On-chain anchoring configuration",
      "Provenance certificate templates",
      "Cross-org trust exchange setup",
      "Regulator-facing verification portal",
      "Staff training on evidence workflows",
    ],
    color: CORAL,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
];

export default function ServicesPage() {
  return (
    <AppShell>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-subtle to-transparent pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-14 text-center">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            Services
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Expert-led AI governance engagements powered by the Verisum platform.
            <br className="hidden sm:block" />
            We do the work. You get the evidence.
          </p>
        </div>
      </section>

      {/* Services grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid md:grid-cols-2 gap-8">
          {services.map((service) => (
            <div
              key={service.title}
              className="border border-border rounded-xl p-8 space-y-5 hover:shadow-md transition-shadow"
            >
              {/* Icon + title */}
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${service.color}12`, color: service.color }}
                >
                  {service.icon}
                </div>
                <div>
                  <h2 className="text-lg font-bold">{service.title}</h2>
                  <p className="text-sm font-medium" style={{ color: service.color }}>
                    {service.tagline}
                  </p>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-muted-foreground leading-relaxed">
                {service.description}
              </p>

              {/* Deliverables */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Deliverables
                </h3>
                <ul className="space-y-1.5">
                  {service.deliverables.map((d) => (
                    <li key={d} className="flex items-start gap-2 text-sm">
                      <svg
                        className="w-3.5 h-3.5 mt-0.5 shrink-0"
                        style={{ color: service.color }}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-muted-foreground">{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl font-bold text-center mb-10">How engagements work</h2>
          <div className="grid sm:grid-cols-3 gap-8 text-center">
            {[
              { step: "1", title: "Scope", desc: "We define what you need — readiness assessment, ongoing programme, or documentation pack." },
              { step: "2", title: "Deliver", desc: "Our governance analysts run assessments, produce documentation, and configure your platform." },
              { step: "3", title: "Embed", desc: "You get ongoing access to your Verisum instance with all evidence, scores, and reports." },
            ].map((s) => (
              <div key={s.step} className="space-y-3">
                <span
                  className="inline-flex items-center justify-center w-10 h-10 rounded-full text-white text-sm font-bold shadow-lg mx-auto"
                  style={{ backgroundColor: BRAND }}
                >
                  {s.step}
                </span>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
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
            Need help getting started?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Tell us about your organisation and we&apos;ll scope the right engagement.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="mailto:hello@verisum.org?subject=Services%20enquiry"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-brand text-white font-semibold shadow-lg shadow-brand/20 hover:bg-brand-hover hover:-translate-y-0.5 hover:shadow-brand/30 transition-all duration-300"
            >
              Get in touch
            </a>
            <a
              href="/upgrade"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full border border-border text-foreground font-semibold hover:bg-muted transition-all duration-300"
            >
              View Platform Pricing
            </a>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
