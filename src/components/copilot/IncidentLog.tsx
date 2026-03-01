"use client";

import { useEffect, useState } from "react";

type Incident = {
  id: string;
  title: string;
  description: string | null;
  ai_vendor_id: string | null;
  ai_vendors: { vendor_name: string } | null;
  impact_level: string;
  resolution: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
};

type Vendor = {
  id: string;
  vendor_name: string;
};

const IMPACT_COLOURS: Record<string, string> = {
  low: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-800",
  critical: "bg-red-200 text-red-900",
};

const STATUS_COLOURS: Record<string, string> = {
  open: "bg-blue-100 text-blue-800",
  investigating: "bg-amber-100 text-amber-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-600",
};

const STATUS_OPTIONS = ["open", "investigating", "resolved", "closed"];
const IMPACT_OPTIONS = ["low", "medium", "high", "critical"];

export default function IncidentLog() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [monthlyLimit, setMonthlyLimit] = useState<number>(Infinity);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<string>("");

  // Add form
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newVendor, setNewVendor] = useState("");
  const [newImpact, setNewImpact] = useState("low");
  const [adding, setAdding] = useState(false);

  async function fetchIncidents() {
    try {
      const url = filter ? `/api/incidents?status=${filter}` : "/api/incidents";
      const res = await fetch(url);
      const data = await res.json();
      if (data.incidents) {
        setIncidents(data.incidents);
        setMonthlyCount(data.monthlyCount);
        setMonthlyLimit(data.monthlyLimit);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function fetchVendors() {
    try {
      const res = await fetch("/api/vendors");
      const data = await res.json();
      if (data.vendors) setVendors(data.vendors);
    } catch {
      // silent
    }
  }

  useEffect(() => {
    fetchIncidents();
    fetchVendors();
  }, []);

  useEffect(() => {
    fetchIncidents();
  }, [filter]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDesc.trim() || null,
          aiVendorId: newVendor || null,
          impactLevel: newImpact,
        }),
      });
      if (res.ok) {
        setNewTitle("");
        setNewDesc("");
        setNewVendor("");
        setNewImpact("low");
        setShowAdd(false);
        fetchIncidents();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to log incident");
      }
    } catch {
      alert("Failed to log incident");
    } finally {
      setAdding(false);
    }
  }

  async function updateStatus(id: string, newStatus: string) {
    await fetch("/api/incidents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: newStatus }),
    });
    fetchIncidents();
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading incidents...</div>;
  }

  const atLimit = monthlyCount >= monthlyLimit;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Incident Log</h3>
          <p className="text-xs text-muted-foreground">
            {monthlyCount} this month{" "}
            {monthlyLimit < Infinity ? `of ${monthlyLimit} limit` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="text-xs border border-border rounded px-2 py-1 bg-background"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          {!showAdd && (
            <button
              onClick={() => setShowAdd(true)}
              disabled={atLimit}
              className="text-sm px-3 py-1.5 rounded bg-brand text-white hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {atLimit ? "Limit reached" : "Log incident"}
            </button>
          )}
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="border border-border rounded-lg p-4 space-y-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">What happened? *</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full border border-border rounded px-3 py-2 text-sm bg-background"
              placeholder="e.g. Confidential data entered into ChatGPT"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Details</label>
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={2}
              className="w-full border border-border rounded px-3 py-2 text-sm bg-background"
              placeholder="Describe what happened, what data was involved, and any immediate actions taken"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">AI tool involved</label>
              <select
                value={newVendor}
                onChange={(e) => setNewVendor(e.target.value)}
                className="w-full border border-border rounded px-3 py-2 text-sm bg-background"
              >
                <option value="">Select vendor...</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vendor_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Impact level</label>
              <select
                value={newImpact}
                onChange={(e) => setNewImpact(e.target.value)}
                className="w-full border border-border rounded px-3 py-2 text-sm bg-background"
              >
                {IMPACT_OPTIONS.map((i) => (
                  <option key={i} value={i}>
                    {i.charAt(0).toUpperCase() + i.slice(1)}
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
              {adding ? "Logging..." : "Log incident"}
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

      {/* Incident list */}
      {incidents.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No incidents logged{filter ? ` with status "${filter}"` : ""}.
        </p>
      ) : (
        <div className="space-y-3">
          {incidents.map((inc) => (
            <div
              key={inc.id}
              className="border border-border rounded-lg p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-medium text-sm">{inc.title}</h4>
                  {inc.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {inc.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      IMPACT_COLOURS[inc.impact_level] ?? IMPACT_COLOURS.low
                    }`}
                  >
                    {inc.impact_level}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      STATUS_COLOURS[inc.status] ?? STATUS_COLOURS.open
                    }`}
                  >
                    {inc.status}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex gap-3">
                  {inc.ai_vendors?.vendor_name && (
                    <span>Tool: {inc.ai_vendors.vendor_name}</span>
                  )}
                  <span>{new Date(inc.created_at).toLocaleDateString()}</span>
                </div>
                {inc.status !== "closed" && (
                  <select
                    value={inc.status}
                    onChange={(e) => updateStatus(inc.id, e.target.value)}
                    className="text-xs border border-border rounded px-2 py-0.5 bg-background"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
