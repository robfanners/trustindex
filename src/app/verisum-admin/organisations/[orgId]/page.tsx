"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ConfirmDialog from "@/components/vcc/ConfirmDialog";
import { useVCCAuth } from "@/context/VCCAuthContext";
import type {
  OrgDetail,
  OrgSurvey,
  OrgSystem,
  OrgOverride,
} from "@/lib/vcc/types";

export default function OrgDetailPage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params.orgId;
  const { hasPermission } = useVCCAuth();

  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Suspend/reinstate dialog
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendAction, setSuspendAction] = useState<"suspend" | "reinstate">(
    "suspend"
  );
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOrg = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/verisum-admin/organisations/${orgId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Error ${res.status}`);
        return;
      }
      const { data } = await res.json();
      setOrg(data);
    } catch {
      setError("Failed to load organisation");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchOrg();
  }, [fetchOrg]);

  const handleSuspendReinstate = useCallback(
    async (reason: string) => {
      setActionLoading(true);
      try {
        const res = await fetch(`/api/verisum-admin/organisations/${orgId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: suspendAction, reason }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          alert(body.error ?? "Action failed");
          return;
        }
        setSuspendOpen(false);
        fetchOrg();
      } catch {
        alert("Action failed");
      } finally {
        setActionLoading(false);
      }
    },
    [orgId, suspendAction, fetchOrg]
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
          href="/verisum-admin/organisations"
          className="text-sm text-blue-600 hover:text-blue-800 mt-2 inline-block"
        >
          Back to organisations
        </a>
      </div>
    );
  }

  if (!org) return null;

  const isSuspended = !!org.suspended_at;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <a
              href="/verisum-admin/organisations"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Organisations
            </a>
            <span className="text-gray-300">/</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{org.email}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-sm capitalize text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
              {org.plan}
            </span>
            {isSuspended ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                Suspended
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                Active
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        {hasPermission("suspend_reinstate") && (
          <div>
            {isSuspended ? (
              <button
                onClick={() => {
                  setSuspendAction("reinstate");
                  setSuspendOpen(true);
                }}
                className="px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
              >
                Reinstate
              </button>
            ) : (
              <button
                onClick={() => {
                  setSuspendAction("suspend");
                  setSuspendOpen(true);
                }}
                className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
              >
                Suspend
              </button>
            )}
          </div>
        )}
      </div>

      {/* Suspension info */}
      {isSuspended && org.suspended_reason && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="text-sm font-medium text-red-800">Suspension reason</div>
          <div className="text-sm text-red-700 mt-1">{org.suspended_reason}</div>
          <div className="text-xs text-red-500 mt-1">
            Suspended {new Date(org.suspended_at!).toLocaleString()}
          </div>
        </div>
      )}

      {/* Profile info */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-gray-500">User ID</dt>
            <dd className="text-gray-900 font-mono text-xs mt-0.5">{org.id}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Email</dt>
            <dd className="text-gray-900 mt-0.5">{org.email}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Plan</dt>
            <dd className="text-gray-900 capitalize mt-0.5">{org.plan}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Joined</dt>
            <dd className="text-gray-900 mt-0.5">
              {new Date(org.created_at).toLocaleDateString()}
            </dd>
          </div>
          {org.stripe_customer_id && (
            <div>
              <dt className="text-gray-500">Stripe Customer</dt>
              <dd className="text-gray-900 font-mono text-xs mt-0.5">
                {org.stripe_customer_id}
              </dd>
            </div>
          )}
          {org.stripe_subscription_id && (
            <div>
              <dt className="text-gray-500">Stripe Subscription</dt>
              <dd className="text-gray-900 font-mono text-xs mt-0.5">
                {org.stripe_subscription_id}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Surveys */}
      <SurveyTable surveys={org.surveys} />

      {/* Systems */}
      <SystemTable systems={org.systems} />

      {/* Overrides */}
      <OverrideTable overrides={org.overrides} />

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={suspendOpen}
        title={
          suspendAction === "suspend"
            ? `Suspend ${org.email}`
            : `Reinstate ${org.email}`
        }
        description={
          suspendAction === "suspend"
            ? "This will immediately suspend the user. They will be unable to access the platform."
            : "This will reinstate the user, restoring their access to the platform."
        }
        confirmLabel={suspendAction === "suspend" ? "Suspend" : "Reinstate"}
        variant={suspendAction === "suspend" ? "danger" : "default"}
        requireReason
        loading={actionLoading}
        onConfirm={handleSuspendReinstate}
        onCancel={() => setSuspendOpen(false)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SurveyTable({ surveys }: { surveys: OrgSurvey[] }) {
  if (surveys.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Surveys</h2>
        <p className="text-sm text-gray-400">No surveys yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">
          Surveys ({surveys.length})
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Title</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Mode</th>
              <th className="text-right px-4 py-2 font-medium text-gray-600">Respondents</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {surveys.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-900">{s.title}</td>
                <td className="px-4 py-2 text-gray-600 capitalize">{s.mode}</td>
                <td className="px-4 py-2 text-right text-gray-600">
                  {s.respondent_count}
                </td>
                <td className="px-4 py-2 text-gray-500">
                  {new Date(s.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SystemTable({ systems }: { systems: OrgSystem[] }) {
  if (systems.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Systems</h2>
        <p className="text-sm text-gray-400">No systems registered</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">
          Systems ({systems.length})
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Type</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Environment</th>
              <th className="text-right px-4 py-2 font-medium text-gray-600">Score</th>
              <th className="text-right px-4 py-2 font-medium text-gray-600">Runs</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {systems.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-900 font-medium">{s.name}</td>
                <td className="px-4 py-2 text-gray-600">{s.type ?? "—"}</td>
                <td className="px-4 py-2 text-gray-600">{s.environment ?? "—"}</td>
                <td className="px-4 py-2 text-right text-gray-600">
                  {s.latest_score !== null ? `${s.latest_score}%` : "—"}
                </td>
                <td className="px-4 py-2 text-right text-gray-600">
                  {s.run_count}
                </td>
                <td className="px-4 py-2 text-gray-500">
                  {new Date(s.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OverrideTable({ overrides }: { overrides: OrgOverride[] }) {
  if (overrides.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Plan Overrides
        </h2>
        <p className="text-sm text-gray-400">No active overrides</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">
          Plan Overrides ({overrides.length})
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Type</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Value</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Reason</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Expires</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {overrides.map((o) => {
              const isRevoked = !!o.revoked_at;
              const isExpired =
                o.expires_at && new Date(o.expires_at) < new Date();
              return (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900 font-mono text-xs">
                    {o.override_type}
                  </td>
                  <td className="px-4 py-2 text-gray-700">{o.override_value}</td>
                  <td className="px-4 py-2 text-gray-600 max-w-xs truncate">
                    {o.reason}
                  </td>
                  <td className="px-4 py-2 text-gray-500">
                    {o.expires_at
                      ? new Date(o.expires_at).toLocaleDateString()
                      : "Never"}
                  </td>
                  <td className="px-4 py-2">
                    {isRevoked ? (
                      <span className="text-xs text-gray-400">Revoked</span>
                    ) : isExpired ? (
                      <span className="text-xs text-amber-600">Expired</span>
                    ) : (
                      <span className="text-xs text-green-600 font-medium">
                        Active
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
