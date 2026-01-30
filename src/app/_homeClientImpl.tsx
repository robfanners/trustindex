"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import AccessGate from "@/components/AccessGate";
import AppShell from "@/components/AppShell";

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const authRequired = searchParams.get("auth") === "required";
  const role = searchParams.get("role") || "verisum";
  const [resumeToken, setResumeToken] = useState("");
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [resumeLoading, setResumeLoading] = useState(false);

  async function resumeAdmin() {
    setResumeError(null);
    setResumeLoading(true);
    try {
      const res = await fetch("/api/resolve-owner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resumeToken }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Could not find that code");
      const runId = json.runId as string;
      router.push(`/api/auth-owner?runId=${runId}&ownerToken=${encodeURIComponent(resumeToken)}&next=/admin/run/${runId}`);
    } catch (e: any) {
      setResumeError(e?.message || "Failed");
    } finally {
      setResumeLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto p-4 md:p-6 lg:p-12">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">TrustIndex™</h1>

      <p className="text-base md:text-lg max-w-2xl mb-8">
        A quantitative trust signal for organisations operating in the AI era. Measuring transparency, inclusion,
        confidence, explainability, and risk.
      </p>

      <div className="space-y-6">
        <div className="border border-verisum-grey rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2">What this measures</h2>
          <ul className="list-disc pl-6 text-verisum-grey space-y-1">
            <li>Transparency in decision-making</li>
            <li>Inclusion and psychological safety</li>
            <li>Employee confidence in leadership</li>
            <li>AI explainability and human oversight</li>
            <li>Risk controls and governance</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <a className="px-5 py-3 rounded bg-verisum-blue text-verisum-white font-semibold hover:bg-[#2a7bb8] text-center" href="/admin/new-run">
            Create a survey
          </a>
          <a className="text-sm text-verisum-grey underline self-center sm:self-start py-3 sm:py-0" href="/verisum?role=verisum&next=/admin/new-run">
            Verisum admin →
          </a>
        </div>

        {(role === "owner" || !authRequired) && (
          <div className="border border-verisum-grey rounded-lg p-6 space-y-3 max-w-2xl">
            <h2 className="text-lg font-semibold">Resume admin access</h2>
            <div className="text-sm text-verisum-grey">
              If you already created a survey, enter your admin code to resume managing it.
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <input
                className="flex-1 min-w-0 border border-verisum-grey rounded px-3 py-2"
                placeholder="Enter admin code"
                value={resumeToken}
                onChange={(e) => setResumeToken(e.target.value)}
              />
              <button
                type="button"
                className="px-4 py-2 rounded border border-verisum-grey bg-verisum-white text-verisum-black disabled:opacity-50 min-h-[44px]"
                onClick={resumeAdmin}
                disabled={resumeLoading || !resumeToken.trim()}
              >
                {resumeLoading ? "Finding…" : "Resume"}
              </button>
            </div>
            {resumeError && <div className="text-sm text-verisum-red">{resumeError}</div>}
          </div>
        )}

        {authRequired && role === "verisum" && (
          <div className="max-w-2xl">
            <AccessGate />
          </div>
        )}
      </div>
      </div>
    </AppShell>
  );
}
