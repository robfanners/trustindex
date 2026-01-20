"use client";

import { supabase } from "@/lib/supabase";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

function randomToken(length = 24) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export const dynamic = "force-dynamic";

export default function BootstrapPage() {
  const searchParams = useSearchParams();
  const shouldCreate = searchParams.get("new") === "1";
  const [copied, setCopied] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    orgName: string;
    title: string;
    runId: string;
    token: string;
  } | null>(null);

  async function copyText(label: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  async function createSurvey() {
    setCreating(true);
    setCreateError(null);

    try {
      const orgName = "Verisum (Demo)";
      const title = `TrustIndex Pilot - ${new Date().toISOString().slice(0, 10)}`;
      const token = randomToken(24);

      const { data: runRow, error: runErr } = await supabase
        .from("survey_runs")
        .insert([{ org_name: orgName, title, mode: "explorer" }])
        .select("id")
        .single();

      if (runErr || !runRow) throw new Error(runErr?.message || "Failed to create survey");

      const runId = runRow.id as string;

      const { error: invErr } = await supabase
        .from("invites")
        .insert([{ run_id: runId, token }]);

      if (invErr) throw new Error(invErr.message);

      setCreated({ orgName, title, runId, token });
    } catch (e: any) {
      setCreateError(e?.message || "Failed to create survey");
    } finally {
      setCreating(false);
    }
  }

  const surveyHref = created ? `/survey/${created.token}` : "";
  const dashboardHref = created ? `/dashboard/${created.runId}` : "";

  if (!shouldCreate) {
    return (
      <main className="p-10 space-y-4">
        <h1 className="text-3xl font-bold">TrustIndex Bootstrap</h1>
        <p className="text-gray-700">
          This page creates a new survey + invite token. To create one, open:
        </p>
        <a className="text-blue-600 underline" href="/admin/bootstrap?new=1">
          /admin/bootstrap?new=1
        </a>
      </main>
    );
  }

  return (
    <main className="p-10 space-y-6">
      <h1 className="text-3xl font-bold">TrustIndex Bootstrap</h1>

      {!created ? (
        <div className="border rounded-lg p-6 space-y-3">
          <div className="font-semibold">Create a new survey</div>

          {createError && <div className="text-red-600 text-sm">{createError}</div>}

          <button
            className="px-4 py-2 border rounded hover:bg-gray-50"
            onClick={createSurvey}
            disabled={creating}
          >
            {creating ? "Creating…" : "Create survey now"}
          </button>
        </div>
      ) : (
        <>
          <div className="border rounded-lg p-6 space-y-2">
            <div><span className="font-semibold">Organisation:</span> {created.orgName}</div>
            <div><span className="font-semibold">Survey:</span> {created.title}</div>
            <div><span className="font-semibold">Run ID:</span> {created.runId}</div>
            <div><span className="font-semibold">Invite token:</span> {created.token}</div>
          </div>

          <div className="border rounded-lg p-6 space-y-3">
            <div className="font-semibold">Links</div>

            <div className="space-y-1">
              <div className="text-sm text-gray-600">Survey link</div>
              <a className="text-blue-600 underline" href={surveyHref}>
                {surveyHref}
              </a>
            </div>

            <div className="space-y-1 pt-2">
              <div className="text-sm text-gray-600">Results link</div>
              <a className="text-blue-600 underline" href={dashboardHref}>
                {dashboardHref}
              </a>
            </div>

            <div className="text-sm text-gray-600 pt-2">
              Complete the survey to populate results, then open the results link.
            </div>
          </div>

          <div className="border rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold">Share this survey</h2>

            <div className="text-sm text-gray-700">
              Recommended: send each person their own link. Each invite token is single-use.
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className="px-3 py-2 border rounded hover:bg-gray-50 text-sm"
                onClick={() => copyText("Survey link copied", `${window.location.origin}${surveyHref}`)}
              >
                Copy survey link
              </button>

              <button
                className="px-3 py-2 border rounded hover:bg-gray-50 text-sm"
                onClick={() => copyText("Results link copied", `${window.location.origin}${dashboardHref}`)}
              >
                Copy results link
              </button>

              <button
                className="px-3 py-2 border rounded hover:bg-gray-50 text-sm"
                onClick={() =>
                  copyText(
                    "Email draft copied",
                    `Subject: TrustIndex survey – quick input requested

Hi,

We’re running a short TrustIndex survey to understand how trust is experienced across the organisation so that we can unlock potential performance improvements for everyone. It takes ~3–4 minutes and we would really value your input.

Please complete using your personal link:
${window.location.origin}${surveyHref}

Thank you.`
                  )
                }
              >
                Copy email draft
              </button>
            </div>

            {copied && <div className="text-sm text-green-700">{copied}</div>}

            <div className="text-xs text-gray-500">
              Next upgrade: generate multiple invites and paste a list of links into email/Slack.
            </div>
          </div>
        </>
      )}
    </main>
  );
}

  // Change these later; hardcoded for v0 bootstrap
  const orgName = "Verisum (Demo)";
  const runTitle = `TrustIndex Pilot - ${new Date().toISOString().slice(0, 10)}`;

  // 1) Create org (or reuse if it exists)
  const { data: existingOrgs, error: orgFindErr } = await supabase
    .from("organisations")
    .select("id,name")
    .eq("name", orgName)
    .limit(1);

  if (orgFindErr) {
    return <pre className="p-8">Error finding org: {orgFindErr.message}</pre>;
  }

  let organisationId = existingOrgs?.[0]?.id as string | undefined;

  if (!organisationId) {
    const { data: orgInsert, error: orgInsertErr } = await supabase
      .from("organisations")
      .insert({ name: orgName })
      .select("id")
      .single();

    if (orgInsertErr) {
      return <pre className="p-8">Error creating org: {orgInsertErr.message}</pre>;
    }

    organisationId = orgInsert.id;
  }

  // 2) Create survey run
  const { data: runInsert, error: runErr } = await supabase
    .from("survey_runs")
    .insert({
      organisation_id: organisationId,
      title: runTitle,
      status: "live",
      opens_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (runErr) {
    return <pre className="p-8">Error creating run: {runErr.message}</pre>;
  }

  const runId = runInsert.id as string;

  // 3) Create invite token
  const token = randomToken(28);

  const { error: inviteErr } = await supabase.from("invites").insert({
    run_id: runId,
    token,
  });

  if (inviteErr) {
    return <pre className="p-8">Error creating invite: {inviteErr.message}</pre>;
  }

  const surveyLink = `/survey/${token}`;
const dashboardLink = `/dashboard/${runId}`;

  return (
    <main className="p-10 space-y-6">
      <h1 className="text-3xl font-bold">TrustIndex Bootstrap</h1>

      <div className="border rounded-lg p-6 space-y-2">
        <div><span className="font-semibold">Organisation:</span> {orgName}</div>
        <div><span className="font-semibold">Run:</span> {runTitle}</div>
        <div><span className="font-semibold">Run ID:</span> {runId}</div>
        <div><span className="font-semibold">Invite token:</span> {token}</div>
      </div>

      <div className="border rounded-lg p-6 space-y-3">
        <div className="font-semibold">Survey link</div>
        <div className="border rounded-lg p-6 space-y-3">
  <div className="font-semibold">Links</div>

  <div>
    <div className="text-sm text-gray-600">Survey link</div>
    <a className="text-blue-600 underline" href={surveyLink}>
      {surveyLink}
    </a>
  </div>

  <div>
    <div className="text-sm text-gray-600">Dashboard link</div>
    <a className="text-blue-600 underline" href={dashboardLink}>
      {dashboardLink}
    </a>
  </div>

  <div className="text-sm text-gray-600">
    Complete the survey to populate results, then open the dashboard.
  </div>
</div>
        <div className="text-sm text-gray-600">
          Open this link in another tab to fill the survey.
        </div>
      </div>
    </main>
  );
}
