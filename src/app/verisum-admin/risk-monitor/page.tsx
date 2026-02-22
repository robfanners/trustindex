"use client";

import { useCallback, useEffect, useState } from "react";
import ConfirmDialog from "@/components/vcc/ConfirmDialog";
import { useVCCAuth } from "@/context/VCCAuthContext";
import type { RiskRunItem, RiskFlagItem } from "@/lib/vcc/types";

type RiskResponse = {
  runs: RiskRunItem[];
  total: number;
  page: number;
  per_page: number;
};

export default function RiskMonitorPage() {
  const { hasPermission } = useVCCAuth();
  const [data, setData] = useState<RiskResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 50;

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState<"flag" | "unflag">("flag");
  const [targetRunId, setTargetRunId] = useState("");
  const [targetSystemId, setTargetSystemId] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Flag fields
  const [flagLabel, setFlagLabel] = useState("");
  const [flagDescription, setFlagDescription] = useState("");

  const fetchRisks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("per_page", String(perPage));

      const res = await fetch(`/api/verisum-admin/risk-monitor?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Error ${res.status}`);
        return;
      }
      const json = await res.json();
      setData(json.data);
    } catch {
      setError("Failed to load risk monitor");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchRisks();
  }, [fetchRisks]);

  const openDialog = (
    action: "flag" | "unflag",
    runId: string,
    systemId: string
  ) => {
    setCurrentAction(action);
    setTargetRunId(runId);
    setTargetSystemId(systemId);
    setFlagLabel("");
    setFlagDescription("");
    setDialogOpen(true);
  };

  const handleAction = useCallback(
    async (reason: string) => {
      setActionLoading(true);
      try {
        const bodyPayload: Record<string, unknown> = {
          action: currentAction,
          reason,
        };
        if (currentAction === "flag") {
          bodyPayload.flag_label = flagLabel || "Admin Flag";
          bodyPayload.flag_description =
            flagDescription || "Flagged by admin";
        }

        const res = await fetch(
          `/api/verisum-admin/systems/${targetSystemId}/runs/${targetRunId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bodyPayload),
          }
        );

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          alert(body.error ?? "Action failed");
          return;
        }

        setDialogOpen(false);
        fetchRisks();
      } catch {
        alert("Action failed");
      } finally {
        setActionLoading(false);
      }
    },
    [currentAction, targetRunId, targetSystemId, flagLabel, flagDescription, fetchRisks]
  );

  const totalPages = data ? Math.ceil(data.total / perPage) : 0;

  function hasAdminFlag(flags: RiskFlagItem[]) {
    return flags.some((f) => f.source === "admin");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Risk Monitor</h1>
        <p className="text-sm text-gray-500 mt-1">
          System runs with active risk flags across the platform
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Owner
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  System
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  Score
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Risk Flags
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Submitted
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && !data ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    Loading…
                  </td>
                </tr>
              ) : data && data.runs.length > 0 ? (
                data.runs.map((r) => {
                  const flags = (r.risk_flags ?? []) as RiskFlagItem[];
                  const adminFlagged = hasAdminFlag(flags);
                  return (
                    <tr
                      key={r.run_id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-gray-600">
                        {r.owner_email ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {r.system_name}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {r.overall_score !== null
                          ? `${r.overall_score}%`
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {flags.map((f, i) => (
                            <span
                              key={i}
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                f.source === "admin"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                              title={f.description}
                            >
                              {f.source === "admin"
                                ? `Admin: ${f.label}`
                                : f.code}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {r.run_submitted_at
                          ? new Date(r.run_submitted_at).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {hasPermission("flag_risk") &&
                            (adminFlagged ? (
                              <button
                                onClick={() =>
                                  openDialog(
                                    "unflag",
                                    r.run_id,
                                    r.system_id
                                  )
                                }
                                className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                              >
                                Unflag
                              </button>
                            ) : (
                              <button
                                onClick={() =>
                                  openDialog("flag", r.run_id, r.system_id)
                                }
                                className="text-xs text-red-600 hover:text-red-800 font-medium"
                              >
                                Flag
                              </button>
                            ))}
                          <a
                            href={`/verisum-admin/systems/${r.system_id}`}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            View System
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    No flagged runs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Page {page} of {totalPages} ({data?.total ?? 0} total)
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={dialogOpen}
        title={
          currentAction === "flag"
            ? "Flag Risk on Run"
            : "Remove Admin Flag"
        }
        description={
          currentAction === "flag"
            ? "Add an admin risk flag to this run."
            : "Remove the admin risk flag from this run. Computed flags will remain."
        }
        confirmLabel={currentAction === "flag" ? "Flag Run" : "Remove Flag"}
        variant={currentAction === "flag" ? "warning" : "default"}
        requireReason
        loading={actionLoading}
        onConfirm={handleAction}
        onCancel={() => setDialogOpen(false)}
      />

      {/* Extra flag fields when flagging */}
      {dialogOpen && currentAction === "flag" && (
        <div className="fixed inset-0 z-[101] flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 mt-80">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Flag Details
            </h4>
            <input
              type="text"
              value={flagLabel}
              onChange={(e) => setFlagLabel(e.target.value)}
              placeholder="Flag label (e.g. Data Privacy Concern)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <textarea
              value={flagDescription}
              onChange={(e) => setFlagDescription(e.target.value)}
              placeholder="Describe the risk…"
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
