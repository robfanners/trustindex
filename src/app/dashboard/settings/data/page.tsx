"use client";

import { useCallback, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { canAccessDataSettings } from "@/lib/entitlements";

// ---------------------------------------------------------------------------
// /dashboard/settings/data — Data & Export
// ---------------------------------------------------------------------------

export default function DataSettingsPage() {
  const { user, profile, signOut } = useAuth();

  const [exportingSurveys, setExportingSurveys] = useState(false);
  const [exportingSystems, setExportingSystems] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const downloadCsv = useCallback(
    async (type: "surveys" | "systems") => {
      const setter = type === "surveys" ? setExportingSurveys : setExportingSystems;
      setter(true);
      setExportMsg(null);
      try {
        const res = await fetch(`/api/settings/export/${type}`);
        if (!res.ok) {
          const d = await res.json().catch(() => ({ error: "Export failed" }));
          setExportMsg(d.error || "Export failed");
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `trustgraph_${type}_export_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        setExportMsg(`${type === "surveys" ? "Survey" : "System"} data exported.`);
      } catch {
        setExportMsg("Something went wrong during export.");
      } finally {
        setter(false);
      }
    },
    []
  );

  const confirmationTarget = profile?.company_name || user?.email || "";

  const handleDeleteAccount = useCallback(async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/settings/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation_name: deleteInput }),
      });
      if (!res.ok) {
        const d = await res.json();
        setDeleteError(d.error || "Failed to delete account");
        return;
      }
      // Sign out and redirect
      await signOut();
      window.location.href = "/";
    } catch {
      setDeleteError("Something went wrong. Please try again.");
    } finally {
      setDeleting(false);
    }
  }, [deleteInput, signOut]);

  // Plan gate: only Pro+
  if (!canAccessDataSettings(profile?.plan)) {
    return (
      <div className="border border-border rounded-lg p-6 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Data & Export</h2>
        <p className="text-sm text-muted-foreground">
          Data export and account management are available on Pro and Enterprise
          plans.
        </p>
        <a
          href="/upgrade"
          className="inline-block px-4 py-2 rounded bg-brand text-white text-sm font-semibold hover:bg-brand-hover"
        >
          Upgrade your plan
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Export TrustOrg data */}
      <div className="border border-border rounded-lg p-6 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          Export TrustOrg data
        </h2>
        <p className="text-sm text-muted-foreground">
          Download all your survey data as a CSV file, including questions,
          responses, dimensions, and scores.
        </p>
        <button
          onClick={() => downloadCsv("surveys")}
          disabled={exportingSurveys}
          className="px-4 py-2 rounded border border-border text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {exportingSurveys ? "Exporting..." : "Download survey CSV"}
        </button>
      </div>

      {/* Export TrustSys data */}
      <div className="border border-border rounded-lg p-6 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          Export TrustSys data
        </h2>
        <p className="text-sm text-muted-foreground">
          Download all your system assessment data as a CSV file, including
          questions, answers, evidence, and scores.
        </p>
        <button
          onClick={() => downloadCsv("systems")}
          disabled={exportingSystems}
          className="px-4 py-2 rounded border border-border text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {exportingSystems ? "Exporting..." : "Download systems CSV"}
        </button>
      </div>

      {exportMsg && (
        <div
          className={`text-sm ${
            exportMsg.includes("exported") ? "text-success" : "text-destructive"
          }`}
        >
          {exportMsg}
        </div>
      )}

      {/* Data retention */}
      <div className="border border-border rounded-lg p-6 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          Data retention
        </h2>
        <p className="text-sm text-muted-foreground">
          Your data is retained for the duration of your subscription. If your
          subscription is cancelled, your data is retained for 90 days before
          being permanently deleted. Contact{" "}
          <a
            href="mailto:hello@verisum.org"
            className="text-brand underline hover:text-foreground"
          >
            hello@verisum.org
          </a>{" "}
          for data deletion requests.
        </p>
      </div>

      {/* Danger zone: delete organisation */}
      <div className="border border-red-300 rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-red-600">Danger zone</h2>

        <p className="text-sm text-muted-foreground">
          Deleting your account will deactivate it and remove access to all your
          data. Your data will be retained for 90 days before permanent
          deletion. This action requires confirmation from our team.
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 rounded border border-red-300 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            Delete my account and all data
          </button>
        ) : (
          <div className="space-y-3 p-4 bg-red-50 rounded">
            <p className="text-sm text-red-700 font-medium">
              To confirm, type &quot;{confirmationTarget}&quot; below:
            </p>
            <input
              className="w-full border border-red-300 rounded px-3 py-2 text-sm"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder={confirmationTarget}
            />
            <div className="flex items-center gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || deleteInput !== confirmationTarget}
                className="px-4 py-2 rounded bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Permanently delete account"}
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteInput("");
                  setDeleteError(null);
                }}
                className="px-4 py-2 rounded border border-border text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
            {deleteError && (
              <div className="text-sm text-red-600">{deleteError}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
