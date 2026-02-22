"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ConfirmDialog from "@/components/vcc/ConfirmDialog";
import { useVCCAuth } from "@/context/VCCAuthContext";
import type { SystemDetail, RiskFlagItem } from "@/lib/vcc/types";

type ActionType = "archive" | "recalculate" | "flag" | "unflag";

export default function SystemDetailPage() {
  const params = useParams<{ systemId: string }>();
  const systemId = params.systemId;
  const { hasPermission } = useVCCAuth();

  const [system, setSystem] = useState<SystemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState<ActionType>("archive");
  const [targetRunId, setTargetRunId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Flag fields
  const [flagLabel, setFlagLabel] = useState("");
  const [flagDescription, setFlagDescription] = useState("");

  const fetchSystem = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/verisum-admin/systems/${systemId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Error ${res.status}`);
        return;
      }
      const { data } = await res.json();
      setSystem(data);
    } catch {
      setError("Failed to load system");
    } finally {
      setLoading(false);
    }
  }, [systemId]);

  useEffect(() => {
    fetchSystem();
  }, [fetchSystem]);

  const openDialog = (action: ActionType, runId?: string) => {
    setCurrentAction(action);
    setTargetRunId(runId ?? null);
    setFlagLabel("");
    setFlagDescription("");
    setDialogOpen(true);
  };

  const handleAction = useCallback(
    async (reason: string) => {
      setActionLoading(true);
      try {
        let url: string;
        let bodyPayload: Record<string, unknown>;

        if (currentAction === "archive") {
          url = `/api/verisum-admin/systems/${systemId}`;
          bodyPayload = { action: "archive", reason };
        } else {
          url = `/api/verisum-admin/systems/${systemId}/runs/${targetRunId}`;
          bodyPayload = { action: currentAction, reason };
          if (currentAction === "flag") {
            bodyPayload.flag_label = flagLabel || "Admin Flag";
            bodyPayload.flag_description =
              flagDescription || "Flagged by admin";
          }
        }

        const res = await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          alert(body.error ?? "Action failed");
          return;
        }

        setDialogOpen(false);
        fetchSystem();
      } catch {
        alert("Action failed");
      } finally {
        setActionLoading(false);
      }
    },
    [
      systemId,
      currentAction,
      targetRunId,
      flagLabel,
      flagDescription,
      fetchSystem,
    ]
  );

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-64" />
        <div className="h-40 bg-gray-200 rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-700">{error}</p>
        <a
          href="/verisum-admin/systems"
          className="text-sm text-blue-600 hover:text-blue-800 mt-2 inline-block"
        >
          Back to systems
        </a>
      </div>
    );
  }

  if (!system) return null;

  function hasAdminFlag(flags: RiskFlagItem[]) {
    return flags.some((f) => f.source === "admin");
  }

  const dialogConfig: Record<
    ActionType,
    { title: string; description: string; label: string; variant: "danger" | "warning" | "default" }
  > = {
    archive: {
      title: `Archive "${system.name}"`,
      description:
        "This will archive the system. It will no longer appear in the owner's dashboard.",
      label: "Archive System",
      variant: "danger",
    },
    recalculate: {
      title: "Recalculate Scores",
      description:
        "This will re-run the scoring engine on the selected run. Existing scores and recommendations will be replaced.",
      label: "Recalculate",
      variant: "warning",
    },
    flag: {
      title: "Flag Risk",
      description:
        "Add an admin risk flag to this run. This will be visible in the Risk Monitor.",
      label: "Flag Run",
      variant: "warning",
    },
    unflag: {
      title: "Remove Admin Flag",
      description:
        "Remove the admin risk flag from this run. Computed flags will remain.",
      label: "Remove Flag",
      variant: "default",
    },
  };

  const cfg = dialogConfig[currentAction];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <a
              href="/verisum-admin/systems"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Systems
            </a>
            <span className="text-gray-300">/</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{system.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            {system.type && (
              <span className="text-sm text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                {system.type}
              </span>
            )}
            {system.environment && (
              <span className="text-sm text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                {system.environment}
              </span>
            )}
            {system.archived ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                Archived
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                Active
              </span>
            )}
          </div>
        </div>

        {/* Archive button */}
        {!system.archived && hasPermission("archive_systems") && (
          <button
            onClick={() => openDialog("archive")}
            className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
          >
            Archive System
          </button>
        )}
      </div>

      {/* System details */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-gray-500">System ID</dt>
            <dd className="text-gray-900 font-mono text-xs mt-0.5">
              {system.id}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Owner</dt>
            <dd className="text-gray-900 mt-0.5">
              {system.owner_email ? (
                <a
                  href={`/verisum-admin/organisations/${system.owner_id}`}
                  className="text-blue-600 hover:text-blue-800"
                >
                  {system.owner_email}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          {system.version_label && (
            <div>
              <dt className="text-gray-500">Version</dt>
              <dd className="text-gray-900 mt-0.5">
                {system.version_label}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-gray-500">Created</dt>
            <dd className="text-gray-900 mt-0.5">
              {new Date(system.created_at).toLocaleString()}
            </dd>
          </div>
        </dl>
      </div>

      {/* Runs table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            Assessment Runs ({system.runs.length})
          </h2>
        </div>
        {system.runs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">
                    Version
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">
                    Status
                  </th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">
                    Score
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">
                    Risk Flags
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">
                    Submitted
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {system.runs.map((run) => {
                  const flags = (run.risk_flags ?? []) as RiskFlagItem[];
                  const adminFlagged = hasAdminFlag(flags);
                  return (
                    <tr key={run.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-900">
                        {run.version_label ?? "—"}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            run.status === "submitted"
                              ? "bg-green-100 text-green-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right text-gray-600">
                        {run.overall_score !== null
                          ? `${run.overall_score}%`
                          : "—"}
                      </td>
                      <td className="px-4 py-2">
                        {flags.length > 0 ? (
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
                                {f.source === "admin" ? "Admin" : f.code}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">None</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-500">
                        {run.submitted_at
                          ? new Date(run.submitted_at).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-2">
                          {run.status === "submitted" &&
                            hasPermission("recalculate_scores") && (
                              <button
                                onClick={() =>
                                  openDialog("recalculate", run.id)
                                }
                                className="text-xs text-amber-600 hover:text-amber-800 font-medium"
                              >
                                Recalculate
                              </button>
                            )}
                          {hasPermission("flag_risk") &&
                            (adminFlagged ? (
                              <button
                                onClick={() => openDialog("unflag", run.id)}
                                className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                              >
                                Unflag
                              </button>
                            ) : (
                              <button
                                onClick={() => openDialog("flag", run.id)}
                                className="text-xs text-red-600 hover:text-red-800 font-medium"
                              >
                                Flag Risk
                              </button>
                            ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-4 text-sm text-gray-400">
            No assessment runs yet
          </div>
        )}
      </div>

      {/* Flag fields (shown above dialog when flagging) */}
      <ConfirmDialog
        open={dialogOpen}
        title={cfg.title}
        description={cfg.description}
        confirmLabel={cfg.label}
        variant={cfg.variant}
        requireReason
        loading={actionLoading}
        onConfirm={handleAction}
        onCancel={() => setDialogOpen(false)}
      />

      {/* Extra flag fields when dialog is open and action is "flag" */}
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
