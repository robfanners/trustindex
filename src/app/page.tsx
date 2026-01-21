"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import AccessGate from "@/components/AccessGate";

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const authRequired = searchParams.get("auth") === "required";
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
      router.push(`/admin/run/${runId}?ownerToken=${encodeURIComponent(resumeToken)}`);
    } catch (e: any) {
      setResumeError(e?.message || "Failed");
    } finally {
      setResumeLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-gray-900 p-12">
      <h1 className="text-4xl font-bold mb-4">TrustIndex™</h1>

      <p className="text-lg max-w-2xl mb-8">
        A quantitative trust signal for organisations operating in the AI era. Measuring transparency, inclusion,
        confidence, explainability, and risk.
      </p>

      <div className="space-y-6">
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2">What this measures</h2>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>Transparency in decision-making</li>
            <li>Inclusion and psychological safety</li>
            <li>Employee confidence in leadership</li>
            <li>AI explainability and human oversight</li>
            <li>Risk controls and governance</li>
          </ul>
        </div>

        <div className="flex gap-4 flex-wrap">
          <a className="px-5 py-3 rounded bg-blue-600 text-white font-semibold" href="/admin/new-run">
            Company Admin: Create a survey
          </a>

          <a className="px-5 py-3 rounded border font-semibold" href="/verisum?role=verisum&next=/admin">
            Verisum Admin
          </a>
        </div>

        <div className="border rounded-lg p-6 space-y-3 max-w-2xl">
          <h2 className="text-lg font-semibold">Resume admin</h2>
          <div className="flex gap-3 flex-wrap items-center">
            <input
              className="flex-1 min-w-[240px] border rounded px-3 py-2"
              placeholder="Enter admin code"
              value={resumeToken}
              onChange={(e) => setResumeToken(e.target.value)}
            />
            <button
              type="button"
              className="px-4 py-2 rounded border disabled:opacity-50"
              onClick={resumeAdmin}
              disabled={resumeLoading || !resumeToken.trim()}
            >
              {resumeLoading ? "Finding…" : "Resume"}
            </button>
          </div>
          {resumeError && <div className="text-sm text-red-600">{resumeError}</div>}
        </div>

        {authRequired && (
          <div className="max-w-2xl">
            <AccessGate />
          </div>
        )}

        <div className="text-sm text-gray-500">
          Status: Developed by Verisum in the UK • TrustIndex MVP
        </div>
      </div>
    </main>
  );
}

