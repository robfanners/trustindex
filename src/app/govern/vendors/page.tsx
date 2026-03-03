"use client";

import { useCallback, useEffect, useState, useMemo } from "react";

type Vendor = {
  id: string;
  vendor_name: string;
  vendor_url: string | null;
  data_location: string | null;
  data_types: string[];
  risk_category: string | null;
  source: string;
  notes: string | null;
  created_at: string;
};

const RISK_COLOURS: Record<string, string> = {
  minimal: "bg-green-100 text-green-800",
  limited: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-800",
  unacceptable: "bg-red-200 text-red-900",
  unassessed: "bg-gray-100 text-gray-600",
};

const SOURCE_COLOURS: Record<string, string> = {
  manual: "bg-blue-100 text-blue-800",
  declaration: "bg-purple-100 text-purple-800",
  integration: "bg-teal-100 text-teal-800",
};

const RISK_OPTIONS = ["minimal", "limited", "high", "unacceptable", "unassessed"];

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [limit, setLimit] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters (client-side)
  const [riskFilter, setRiskFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");

  // Pagination (client-side)
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Add vendor form
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formRisk, setFormRisk] = useState("unassessed");
  const [formNotes, setFormNotes] = useState("");

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/vendors");
      if (res.ok) {
        const data = await res.json();
        setVendors(data.vendors ?? []);
        setLimit(data.limit ?? 0);
        setCount(data.count ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  // Derived: filtered vendors
  const filtered = useMemo(() => {
    let result = vendors;
    if (riskFilter) {
      result = result.filter((v) => (v.risk_category ?? "unassessed") === riskFilter);
    }
    if (sourceFilter) {
      result = result.filter((v) => v.source === sourceFilter);
    }
    return result;
  }, [vendors, riskFilter, sourceFilter]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  // Summary counts
  const highRiskCount = vendors.filter(
    (v) => v.risk_category === "high" || v.risk_category === "unacceptable"
  ).length;
  const unassessedCount = vendors.filter(
    (v) => !v.risk_category || v.risk_category === "unassessed"
  ).length;

  const atLimit = count >= limit;

  async function handleAddVendor(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorName: formName.trim(),
          vendorUrl: formUrl.trim() || undefined,
          dataLocation: formLocation.trim() || undefined,
          riskCategory: formRisk,
          notes: formNotes.trim() || undefined,
        }),
      });
      if (res.ok) {
        setFormName("");
        setFormUrl("");
        setFormLocation("");
        setFormRisk("unassessed");
        setFormNotes("");
        setShowForm(false);
        fetchVendors();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this vendor? This action cannot be undone.")) return;
    const res = await fetch(`/api/vendors?id=${id}`, { method: "DELETE" });
    if (res.ok) fetchVendors();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-brand/10 text-brand">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-semibold">AI Vendors</h1>
          <p className="text-sm text-muted-foreground">
            Track and manage AI vendor relationships and risk categorisation
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Total Vendors
          </p>
          <p className="text-2xl font-semibold mt-1">{count}</p>
        </div>
        <div className="border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            High / Unacceptable
          </p>
          <p className="text-2xl font-semibold mt-1 text-red-600">{highRiskCount}</p>
        </div>
        <div className="border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Unassessed
          </p>
          <p className="text-2xl font-semibold mt-1 text-amber-600">{unassessedCount}</p>
        </div>
        <div className="border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Plan Limit
          </p>
          <p className="text-2xl font-semibold mt-1">
            {count} <span className="text-base font-normal text-muted-foreground">of {limit}</span>
          </p>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap gap-3">
        <select
          value={riskFilter}
          onChange={(e) => {
            setRiskFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
        >
          <option value="">All risk levels</option>
          {RISK_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {capitalize(r)}
            </option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => {
            setSourceFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
        >
          <option value="">All sources</option>
          <option value="manual">Manual</option>
          <option value="declaration">Declaration</option>
          <option value="integration">Integration</option>
        </select>
      </div>

      {/* Add vendor button + collapsible form */}
      <div>
        <button
          onClick={() => setShowForm((s) => !s)}
          disabled={atLimit}
          className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {atLimit ? "Limit reached" : "Add Vendor"}
        </button>

        {showForm && !atLimit && (
          <form
            onSubmit={handleAddVendor}
            className="mt-4 border border-border rounded-lg p-4 space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Vendor name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. OpenAI"
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Website URL</label>
                <input
                  type="url"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Data location</label>
                <input
                  type="text"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  placeholder="e.g. EU, US, Global"
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Risk category</label>
                <select
                  value={formRisk}
                  onChange={(e) => setFormRisk(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
                >
                  {RISK_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {capitalize(r)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={2}
                placeholder="Optional notes about this vendor..."
                className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting || !formName.trim()}
                className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors disabled:opacity-50"
              >
                {submitting ? "Adding..." : "Save Vendor"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          Loading vendors...
        </div>
      ) : filtered.length === 0 && !riskFilter && !sourceFilter ? (
        <div className="border border-dashed border-border rounded-xl p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No vendors registered yet. Add vendors manually or they will appear automatically from
            staff declarations.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No vendors match the selected filters.
          </p>
        </div>
      ) : (
        <>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                    Vendor
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                    Data Location
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                    Data Types
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                    Risk
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                    Source
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginated.map((v) => {
                  const risk = v.risk_category ?? "unassessed";
                  return (
                    <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium">{v.vendor_name}</div>
                        {v.vendor_url && (
                          <a
                            href={v.vendor_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:underline"
                          >
                            {v.vendor_url}
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {v.data_location ?? "\u2014"}
                      </td>
                      <td className="px-4 py-3">
                        {v.data_types.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {v.data_types.map((dt) => (
                              <span
                                key={dt}
                                className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                              >
                                {dt}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">{"\u2014"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            RISK_COLOURS[risk] ?? RISK_COLOURS.unassessed
                          }`}
                        >
                          {capitalize(risk)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            SOURCE_COLOURS[v.source] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {capitalize(v.source)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDelete(v.id)}
                          className="text-xs text-red-600 hover:text-red-800 transition-colors"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {filtered.length} vendor{filtered.length !== 1 ? "s" : ""}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1 rounded border border-border disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 rounded border border-border disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
