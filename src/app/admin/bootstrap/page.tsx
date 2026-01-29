"use client";

import { useActionState, useState } from "react";
import { createDemoRunAction, type CreateState } from "./actions";

export const dynamic = "force-dynamic";

export default function BootstrapPage() {
  const [copied, setCopied] = useState<string | null>(null);
  const [state, formAction, isPending] = useActionState<CreateState>(createDemoRunAction, {
    runId: null,
    token: null,
    error: null,
  });

  async function copyText(label: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  const runId = state.runId;
  const token = state.token;
  const surveyLink = token ? `/survey/${token}` : "";
  const dashboardLink = runId ? `/dashboard/${runId}` : "";
  const adminRunLink = runId ? `/admin/run/${runId}` : "";

  return (
    <main className="p-10 space-y-6">
      <h1 className="text-3xl font-bold">TrustIndex Bootstrap</h1>

      {!runId || !token ? (
        <div className="border border-verisum-grey rounded-lg p-6 space-y-3">
          <div className="font-semibold">Create a survey</div>
          {state.error && <div className="text-verisum-red text-sm">{state.error}</div>}
          <form action={formAction}>
            <button
              className="px-4 py-2 border border-verisum-grey rounded hover:bg-[#f5f5f5]"
              type="submit"
              disabled={isPending}
            >
              {isPending ? "Creating…" : "Create survey"}
            </button>
          </form>
        </div>
      ) : (
        <>
          <div className="border border-verisum-grey rounded-lg p-6 space-y-2">
            <div>
              <span className="font-semibold">Run ID:</span> {runId}
            </div>
            <div>
              <span className="font-semibold">Invite token:</span> {token}
            </div>
          </div>

          <div className="border border-verisum-grey rounded-lg p-6 space-y-3">
            <div className="font-semibold">Links</div>

            <div className="space-y-1">
              <div className="text-sm text-verisum-grey">Survey link</div>
              <a className="text-verisum-blue underline" href={surveyLink}>
                {surveyLink}
              </a>
            </div>

            <div className="space-y-1 pt-2">
              <div className="text-sm text-verisum-grey">Results link</div>
              <a className="text-verisum-blue underline" href={dashboardLink}>
                {dashboardLink}
              </a>
            </div>

            <div className="space-y-1 pt-2">
              <div className="text-sm text-verisum-grey">Survey Dashboard</div>
              <a className="text-verisum-blue underline" href={adminRunLink}>
                {adminRunLink}
              </a>
            </div>
          </div>

          <div className="border border-verisum-grey rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold">Share this survey</h2>

            <div className="text-sm text-verisum-grey">
              Recommended: send each person their own link. Each invite token is single-use.
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className="px-3 py-2 border border-verisum-grey rounded hover:bg-[#f5f5f5] text-sm"
                onClick={() => copyText("Survey link copied", surveyLink)}
              >
                Copy survey link
              </button>

              <button
                className="px-3 py-2 border border-verisum-grey rounded hover:bg-[#f5f5f5] text-sm"
                onClick={() => copyText("Results link copied", dashboardLink)}
              >
                Copy results link
              </button>

              <button
                className="px-3 py-2 border border-verisum-grey rounded hover:bg-[#f5f5f5] text-sm"
                onClick={() =>
                  copyText(
                    "Email draft copied",
                    `Subject: TrustIndex survey – quick input requested

Hi,

We’re running a short TrustIndex survey to understand how trust is experienced across the organisation so that we can unlock potential performance improvements for everyone. It takes ~3–4 minutes and we would really value your input.

Please complete using your personal link:
${surveyLink}

Thank you.`
                  )
                }
              >
                Copy email draft
              </button>
            </div>

            {copied && <div className="text-sm text-verisum-green">{copied}</div>}
          </div>
        </>
      )}
    </main>
  );
}
