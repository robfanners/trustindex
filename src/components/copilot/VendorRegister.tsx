"use client";

import { useEffect, useState } from "react";

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

const RISK_OPTIONS = ["minimal", "limited", "high", "unacceptable", "unassessed"];

export default function VendorRegister() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [limit, setLimit] = useState<number>(Infinity);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  // Add form
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newRisk, setNewRisk] = useState("unassessed");
  const [adding, setAdding] = useState(false);

  async function fetchVendors() {
    try {
      const res = await fetch("/api/vendors");
      const data = await res.json();
      if (data.vendors) {
        setVendors(data.vendors);
        setLimit(data.limit);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchVendors();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorName: newName.trim(),
          vendorUrl: newUrl.trim() || null,
          dataLocation: newLocation.trim() || null,
          riskCategory: newRisk,
        }),
      });
      if (res.ok) {
        setNewName("");
        setNewUrl("");
        setNewLocation("");
        setNewRisk("unassessed");
        setShowAdd(false);
        fetchVendors();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to add vendor");
      }
    } catch {
      alert("Failed to add vendor");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this vendor from the register?")) return;
    await fetch(`/api/vendors?id=${id}`, { method: "DELETE" });
    fetchVendors();
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading vendors...</div>;
  }

  const atLimit = vendors.length >= limit;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">AI Vendor Register</h3>
          <p className="text-xs text-muted-foreground">
            {vendors.length} vendor{vendors.length !== 1 ? "s" : ""}{" "}
            {limit < Infinity ? `of ${limit} limit` : ""}
          </p>
        </div>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            disabled={atLimit}
            className="text-sm px-3 py-1.5 rounded bg-brand text-white hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {atLimit ? "Limit reached" : "Add vendor"}
          </button>
        )}
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="border border-border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Vendor name *</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full border border-border rounded px-3 py-2 text-sm bg-background"
                placeholder="e.g. OpenAI"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Website</label>
              <input
                type="text"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="w-full border border-border rounded px-3 py-2 text-sm bg-background"
                placeholder="e.g. openai.com"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Data location</label>
              <input
                type="text"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                className="w-full border border-border rounded px-3 py-2 text-sm bg-background"
                placeholder="e.g. US, EU"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Risk category</label>
              <select
                value={newRisk}
                onChange={(e) => setNewRisk(e.target.value)}
                className="w-full border border-border rounded px-3 py-2 text-sm bg-background"
              >
                {RISK_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={adding}
              className="text-sm px-4 py-2 rounded bg-brand text-white hover:bg-brand-hover disabled:opacity-50"
            >
              {adding ? "Adding..." : "Add"}
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="text-sm px-4 py-2 rounded border border-border hover:bg-[#f5f5f5]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Vendor table */}
      {vendors.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No vendors registered yet. Add vendors manually or they&apos;ll appear
          automatically from staff declarations.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 font-medium">Vendor</th>
                <th className="text-left py-2 px-3 font-medium">Location</th>
                <th className="text-left py-2 px-3 font-medium">Data types</th>
                <th className="text-left py-2 px-3 font-medium">Risk</th>
                <th className="text-left py-2 px-3 font-medium">Source</th>
                <th className="text-right py-2 px-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id} className="border-b border-border/30">
                  <td className="py-2 px-3">
                    <div className="font-medium">{v.vendor_name}</div>
                    {v.vendor_url && (
                      <div className="text-xs text-muted-foreground">{v.vendor_url}</div>
                    )}
                  </td>
                  <td className="py-2 px-3 text-muted-foreground">
                    {v.data_location || "\u2014"}
                  </td>
                  <td className="py-2 px-3">
                    {v.data_types && v.data_types.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {v.data_types.map((dt: string) => (
                          <span
                            key={dt}
                            className="text-xs bg-gray-100 px-2 py-0.5 rounded"
                          >
                            {dt}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">\u2014</span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        RISK_COLOURS[v.risk_category ?? "unassessed"] ?? RISK_COLOURS.unassessed
                      }`}
                    >
                      {v.risk_category ?? "unassessed"}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-xs text-muted-foreground capitalize">
                    {v.source}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <button
                      onClick={() => handleDelete(v.id)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
