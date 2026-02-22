"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ConfirmDialog from "@/components/vcc/ConfirmDialog";
import { useVCCAuth } from "@/context/VCCAuthContext";
import type { SurveyDetail } from "@/lib/vcc/types";

export default function SurveyDetailPage() {
  const params = useParams<{ runId: string }>();
  const runId = params.runId;
  const { hasPermission } = useVCCAuth();

  const [survey, setSurvey] = useState<SurveyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState<"close" | "reset_tokens">(
    "close"
  );
  const [actionLoading, setActionLoading] = useState(false);

  const fetchSurvey = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/verisum-admin/surveys/${runId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Error ${res.status}`);
        return;
      }
      const { data } = await res.json();
      setSurvey(data);
    } catch {
      setError("Failed to load survey");
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    fetchSurvey();
  }, [fetchSurvey]);

  const handleAction = useCallback(
    async (reason: string) => {
      setActionLoading(true);
      try {
        const res = await fetch(`/api/verisum-admin/surveys/${runId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: currentAction, reason }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          alert(body.error ?? "Action failed");
          return;
        }
        setDialogOpen(false);
        fetchSurvey();
      } catch {
        alert("Action failed");
      } finally {
        setActionLoading(false);
      }
    },
    [runId, currentAction, fetchSurvey]
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
          href="/verisum-admin/surveys"
          className="text-sm text-blue-600 hover:text-blue-800 mt-2 inline-block"
        >
          Back to surveys
        </a>
      </div>
    );
  }

  if (!survey) return null;

  function statusBadge(s: string) {
    switch (s) {
      case "live":
        return "bg-green-100 text-green-700";
      case "closed":
        return "bg-gray-100 text-gray-600";
      case "draft":
        return "bg-amber-100 text-amber-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <a
              href="/verisum-admin/surveys"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Surveys
            </a>
            <span className="text-gray-300">/</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{survey.title}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-sm capitalize text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
              {survey.mode}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(survey.status)}`}
            >
              {survey.status}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {survey.status !== "closed" && hasPermission("close_surveys") && (
            <button
              onClick={() => {
                setCurrentAction("close");
                setDialogOpen(true);
              }}
              className="px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
            >
              Close Survey
            </button>
          )}
          {hasPermission("reset_tokens") && (
            <button
              onClick={() => {
                setCurrentAction("reset_tokens");
                setDialogOpen(true);
              }}
              className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
            >
              Reset Tokens
            </button>
          )}
        </div>
      </div>

      {/* Details card */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-gray-500">Survey ID</dt>
            <dd className="text-gray-900 font-mono text-xs mt-0.5">
              {survey.id}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Owner</dt>
            <dd className="text-gray-900 mt-0.5">
              {survey.owner_email ?? (
                <span className="text-gray-400 italic">Unclaimed</span>
              )}
            </dd>
          </div>
          {survey.owner_user_id && (
            <div>
              <dt className="text-gray-500">Owner ID</dt>
              <dd className="text-gray-900 font-mono text-xs mt-0.5">
                <a
                  href={`/verisum-admin/organisations/${survey.owner_user_id}`}
                  className="text-blue-600 hover:text-blue-800"
                >
                  {survey.owner_user_id}
                </a>
              </dd>
            </div>
          )}
          <div>
            <dt className="text-gray-500">Mode</dt>
            <dd className="text-gray-900 capitalize mt-0.5">{survey.mode}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Respondents</dt>
            <dd className="text-gray-900 mt-0.5">
              {survey.respondent_count}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Created</dt>
            <dd className="text-gray-900 mt-0.5">
              {new Date(survey.created_at).toLocaleString()}
            </dd>
          </div>
          {survey.opens_at && (
            <div>
              <dt className="text-gray-500">Opens At</dt>
              <dd className="text-gray-900 mt-0.5">
                {new Date(survey.opens_at).toLocaleString()}
              </dd>
            </div>
          )}
          {survey.organisation_id && (
            <div>
              <dt className="text-gray-500">Organisation ID</dt>
              <dd className="text-gray-900 font-mono text-xs mt-0.5">
                {survey.organisation_id}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Invites table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            Invite Links ({survey.invites.length})
          </h2>
        </div>
        {survey.invites.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">
                    Token
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">
                    Team
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">
                    Level
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">
                    Location
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {survey.invites.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs text-gray-700">
                      {inv.token.substring(0, 6)}…
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {inv.team ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {inv.level ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {inv.location ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-4 text-sm text-gray-400">
            No invite links
          </div>
        )}
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={dialogOpen}
        title={
          currentAction === "close"
            ? `Close "${survey.title}"`
            : `Reset Tokens for "${survey.title}"`
        }
        description={
          currentAction === "close"
            ? "This will close the survey immediately. Respondents will no longer be able to submit responses."
            : `This will regenerate all ${survey.invites.length} invite token(s). Existing links will stop working.`
        }
        confirmLabel={currentAction === "close" ? "Close Survey" : "Reset Tokens"}
        variant={currentAction === "close" ? "warning" : "default"}
        requireReason
        loading={actionLoading}
        onConfirm={handleAction}
        onCancel={() => setDialogOpen(false)}
      />
    </div>
  );
}
