"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import type { AuditLogEntry } from "@/lib/vcc/types";

type AuditResponse = {
  entries: AuditLogEntry[];
  total: number;
  page: number;
  per_page: number;
};

export default function AuditLogPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [actionFilter, setActionFilter] = useState("");
  const [targetType, setTargetType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 50;

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const fetchLog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("per_page", String(perPage));
      if (actionFilter) params.set("action", actionFilter);
      if (targetType) params.set("target_type", targetType);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);

      const res = await fetch(`/api/verisum-admin/audit-log?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Error ${res.status}`);
        return;
      }
      const json = await res.json();
      setData(json.data);
    } catch {
      setError("Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, targetType, fromDate, toDate]);

  useEffect(() => {
    fetchLog();
  }, [fetchLog]);

  const handleActionInput = (value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setActionFilter(value);
      setPage(1);
    }, 300);
  };

  const totalPages = data ? Math.ceil(data.total / perPage) : 0;

  // Expanded row state
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <p className="text-sm text-gray-500 mt-1">
          Immutable record of all admin operations
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Filter by action…"
          onChange={(e) => handleActionInput(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-48 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <select
          value={targetType}
          onChange={(e) => { setTargetType(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">All targets</option>
          <option value="organisation">Organisation</option>
          <option value="survey">Survey</option>
          <option value="system">System</option>
          <option value="role">Role</option>
        </select>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="From"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => { setToDate(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="To"
        />
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
                <th className="text-left px-4 py-3 font-medium text-gray-600">Time</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Admin</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Action</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Target</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Reason</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && !data ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    Loading…
                  </td>
                </tr>
              ) : data && data.entries.length > 0 ? (
                data.entries.map((entry) => (
                  <>
                    <tr
                      key={entry.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() =>
                        setExpandedId(
                          expandedId === entry.id ? null : entry.id
                        )
                      }
                    >
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(entry.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-900">{entry.admin_email}</div>
                        <div className="text-xs text-gray-400">
                          {entry.admin_role}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                          {entry.action}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-600">{entry.target_type}</div>
                        <div className="text-xs text-gray-400 font-mono">
                          {entry.target_id.substring(0, 8)}…
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                        {entry.reason}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        <svg
                          className={`w-4 h-4 transition-transform ${
                            expandedId === entry.id ? "rotate-180" : ""
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </td>
                    </tr>
                    {expandedId === entry.id && (
                      <tr key={`${entry.id}-detail`}>
                        <td
                          colSpan={6}
                          className="px-4 py-4 bg-gray-50 border-t border-gray-100"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            {entry.before_snapshot && (
                              <div>
                                <div className="font-semibold text-gray-600 mb-1">
                                  Before
                                </div>
                                <pre className="bg-white border border-gray-200 rounded p-3 overflow-x-auto text-gray-700">
                                  {JSON.stringify(
                                    entry.before_snapshot,
                                    null,
                                    2
                                  )}
                                </pre>
                              </div>
                            )}
                            {entry.after_snapshot && (
                              <div>
                                <div className="font-semibold text-gray-600 mb-1">
                                  After
                                </div>
                                <pre className="bg-white border border-gray-200 rounded p-3 overflow-x-auto text-gray-700">
                                  {JSON.stringify(
                                    entry.after_snapshot,
                                    null,
                                    2
                                  )}
                                </pre>
                              </div>
                            )}
                            {entry.metadata && (
                              <div className="md:col-span-2">
                                <div className="font-semibold text-gray-600 mb-1">
                                  Metadata
                                </div>
                                <pre className="bg-white border border-gray-200 rounded p-3 overflow-x-auto text-gray-700">
                                  {JSON.stringify(entry.metadata, null, 2)}
                                </pre>
                              </div>
                            )}
                            <div className="md:col-span-2">
                              <span className="text-gray-500">Full Target ID: </span>
                              <span className="font-mono text-gray-700">
                                {entry.target_id}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No audit log entries
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
    </div>
  );
}
