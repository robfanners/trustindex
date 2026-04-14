"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, Gavel, FileText, Plug } from "lucide-react";
import ComplianceGrid from "@/components/control-centre/ComplianceGrid";
import RegFeedCard from "@/components/control-centre/RegFeedCard";

type Framework = {
  id: string;
  name: string;
  coverage_pct: number;
  status: string;
  due_date: string | null;
};

type RegUpdate = {
  id: string;
  title: string;
  jurisdictions: string[];
  published_at: string;
};

type ComplianceData = {
  frameworks?: Framework[];
  regulatory?: RegUpdate[];
};

// Curated framework reference links. Summaries only — no licensed text embedded.
const FRAMEWORK_REFS: Record<string, { summary: string; officialUrl: string; scope: string }> = {
  "EU AI Act": {
    summary:
      "Regulation (EU) 2024/1689 — risk-based governance for AI systems placed on the EU market. Key articles: Art. 6 (risk classification), Art. 9 (risk management), Art. 10 (data governance), Art. 14 (human oversight), Art. 15 (accuracy/robustness).",
    officialUrl: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj",
    scope: "EU-wide, extraterritorial where AI output is used in the EU.",
  },
  "ISO 42001": {
    summary:
      "ISO/IEC 42001:2023 — AI Management System (AIMS). Mirrors ISO 27001 structure with AI-specific controls (A.2–A.10) covering policies, impact assessment, data, lifecycle, third-party suppliers, and information for interested parties.",
    officialUrl: "https://www.iso.org/standard/81230.html",
    scope: "Voluntary management system standard; certifiable.",
  },
  "NIST AI RMF": {
    summary:
      "NIST AI Risk Management Framework 1.0 — voluntary guidance structured around four functions: Govern, Map, Measure, Manage. Anchored by the AI RMF Playbook and Generative AI Profile (NIST AI 600-1).",
    officialUrl: "https://www.nist.gov/itl/ai-risk-management-framework",
    scope: "Voluntary; widely referenced by US agencies and vendors.",
  },
  "GDPR": {
    summary:
      "General Data Protection Regulation — where AI processes personal data: Art. 5 (principles), Art. 22 (automated decisioning), Art. 35 (DPIA), Art. 13-14 (transparency), and Recital 71 (meaningful info about logic).",
    officialUrl: "https://gdpr-info.eu/",
    scope: "EU/EEA, and processing of EU data subjects' data.",
  },
  "UK AI Principles": {
    summary:
      "UK's pro-innovation cross-sector principles (2023 white paper): safety, transparency, fairness, accountability, contestability. Enforced by existing regulators (ICO, CMA, FCA, Ofcom).",
    officialUrl: "https://www.gov.uk/government/publications/ai-regulation-a-pro-innovation-approach",
    scope: "UK; regulator-led, not a single statute (yet).",
  },
};

export default function RegulationCompliancePage() {
  const [data, setData] = useState<ComplianceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"frameworks" | "regulatory">("frameworks");

  useEffect(() => {
    fetch("/api/dashboard/control-centre")
      .then((r) => r.json())
      .then((d) => setData({ frameworks: d.frameworks, regulatory: d.regulatory }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const frameworks = data?.frameworks ?? [];
  const regulatory = data?.regulatory ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Gavel className="w-6 h-6 text-[var(--brand,#673DE6)]" />
            <h1 className="text-2xl font-semibold tracking-tight">Regulation & Compliance</h1>
          </div>
          <p className="text-sm text-[var(--muted-foreground,#6B7280)] mt-1">
            Track compliance framework coverage, surface gaps, and monitor the regulatory feed in one place.
          </p>
        </div>
        <Link
          href="/dashboard/settings/integrations"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand,#673DE6)] hover:underline"
        >
          <Plug className="w-4 h-4" />
          Connect more feeds
        </Link>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-[var(--border,rgba(0,0,0,0.08))]">
        <button
          type="button"
          onClick={() => setTab("frameworks")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "frameworks"
              ? "border-[var(--brand,#673DE6)] text-[var(--brand,#673DE6)]"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          Compliance Frameworks ({frameworks.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("regulatory")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "regulatory"
              ? "border-[var(--brand,#673DE6)] text-[var(--brand,#673DE6)]"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          Regulatory Feed ({regulatory.length})
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
        </div>
      ) : tab === "frameworks" ? (
        <div className="flex flex-col gap-6">
          {/* Framework coverage grid */}
          <ComplianceGrid frameworks={frameworks} />

          {/* Framework detail cards — summary + gap count + reference link */}
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Framework detail</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {frameworks.map((fw) => {
                const ref = FRAMEWORK_REFS[fw.name];
                const gapPct = Math.max(0, 100 - fw.coverage_pct);
                const coverageClass =
                  fw.coverage_pct >= 85
                    ? "bg-emerald-50 text-emerald-700"
                    : fw.coverage_pct >= 70
                    ? "bg-amber-50 text-amber-700"
                    : "bg-red-50 text-red-700";
                return (
                  <div
                    key={fw.id}
                    className="rounded-xl border border-[var(--border,rgba(0,0,0,0.08))] bg-white p-5 flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">{fw.name}</h3>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${coverageClass}`}>
                        {fw.coverage_pct}% covered
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 flex items-center gap-3">
                      <span>Status: <strong>{fw.status}</strong></span>
                      {gapPct > 0 ? (
                        <span className="text-red-700">{gapPct}% gap</span>
                      ) : (
                        <span className="text-emerald-700">Fully covered</span>
                      )}
                    </div>
                    {ref ? (
                      <>
                        <p className="text-xs text-gray-600 leading-relaxed">{ref.summary}</p>
                        <p className="text-[11px] text-gray-500 italic">{ref.scope}</p>
                        <a
                          href={ref.officialUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand,#673DE6)] hover:underline"
                        >
                          View official text <ExternalLink className="w-3 h-3" />
                        </a>
                      </>
                    ) : (
                      <p className="text-xs text-gray-500">Framework reference pending.</p>
                    )}
                    <div className="pt-2 mt-auto border-t border-gray-100 flex items-center justify-between">
                      <Link
                        href="/compliance/iso-42001"
                        className="text-xs font-medium text-[var(--brand,#673DE6)] hover:underline inline-flex items-center gap-1"
                      >
                        View controls & evidence <ArrowRight className="w-3 h-3" />
                      </Link>
                      {gapPct > 0 ? (
                        <Link
                          href="/actions"
                          className="text-xs font-medium text-red-700 hover:underline"
                        >
                          Close gaps
                        </Link>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {frameworks.length === 0 && (
                <div className="col-span-full rounded-xl border border-dashed border-gray-300 p-8 text-center">
                  <FileText className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">No frameworks tracked yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Regulatory feed */}
          <RegFeedCard updates={regulatory} />
          <div className="rounded-xl border border-[var(--border,rgba(0,0,0,0.08))] bg-white p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Connected sources</h3>
            <p className="text-xs text-gray-600 mb-4">
              Verisum ships with defaults (EU AI Act register, ICO, NIST). Add your own feeds via Integrations.
            </p>
            <Link
              href="/dashboard/settings/integrations"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand,#673DE6)] hover:underline"
            >
              <Plug className="w-4 h-4" />
              Manage regulatory feed integrations
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
