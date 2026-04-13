"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AuthenticatedShell from "@/components/AuthenticatedShell";
import RequireAuth from "@/components/RequireAuth";
import EmptyState from "@/components/ui/EmptyState";

type DataInventoryEntry = {
  id: string;
  data_type: string;
  classification:
    | "none"
    | "public"
    | "internal"
    | "confidential"
    | "pii"
    | "sensitive_pii"
    | "phi"
    | "financial";
  residency: "uk" | "eu" | "us" | "apac" | "global" | "unknown";
  volume_estimate?: string | null;
  retention_days?: number | null;
  source_description?: string | null;
  processor?: string | null;
  created_at: string;
  updated_at: string;
};

type Assessment = {
  id: string;
  system_name: string;
  version_label?: string | null;
};

const CLASSIFICATION_COLORS: Record<string, string> = {
  none: "bg-gray-100 text-gray-800",
  public: "bg-green-100 text-green-800",
  internal: "bg-blue-100 text-blue-800",
  confidential: "bg-orange-100 text-orange-800",
  pii: "bg-red-100 text-red-800",
  sensitive_pii: "bg-red-200 text-red-900",
  phi: "bg-purple-100 text-purple-800",
  financial: "bg-amber-100 text-amber-800",
};

const RESIDENCY_LABELS: Record<string, string> = {
  uk: "United Kingdom",
  eu: "European Union",
  us: "United States",
  apac: "Asia Pacific",
  global: "Global",
  unknown: "Unknown",
};

export default function DataGovernancePage() {
  return (
    <RequireAuth>
      <AuthenticatedShell>
        <DataGovernanceContent />
      </AuthenticatedShell>
    </RequireAuth>
  );
}

function DataGovernanceContent() {
  const params = useParams<{ assessmentId: string }>();
  const assessmentId = params?.assessmentId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [entries, setEntries] = useState<DataInventoryEntry[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DataInventoryEntry | null>(null);
  const [formData, setFormData] = useState({
    data_type: "",
    classification: "internal" as DataInventoryEntry["classification"],
    residency: "unknown" as DataInventoryEntry["residency"],
    volume_estimate: "",
    retention_days: "",
    source_description: "",
    processor: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // Load assessment and inventory
  useEffect(() => {
    if (!assessmentId) return;
    loadData();
  }, [assessmentId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [assRes, invRes] = await Promise.all([
        fetch(`/api/trustsys/assessments/${assessmentId}`),
        fetch(`/api/systems/${assessmentId}/data-inventory`),
      ]);

      if (!assRes.ok) {
        setError("Failed to load assessment");
        return;
      }

      const assData = await assRes.json();
      setAssessment(assData.assessment);

      if (invRes.ok) {
        const invData = await invRes.json();
        setEntries(invData.entries || []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleAddClick = useCallback(() => {
    setEditingEntry(null);
    setFormData({
      data_type: "",
      classification: "internal",
      residency: "unknown",
      volume_estimate: "",
      retention_days: "",
      source_description: "",
      processor: "",
    });
    setShowModal(true);
  }, []);

  const handleEditClick = useCallback((entry: DataInventoryEntry) => {
    setEditingEntry(entry);
    setFormData({
      data_type: entry.data_type,
      classification: entry.classification,
      residency: entry.residency,
      volume_estimate: entry.volume_estimate ?? "",
      retention_days: entry.retention_days ? String(entry.retention_days) : "",
      source_description: entry.source_description ?? "",
      processor: entry.processor ?? "",
    });
    setShowModal(true);
  }, []);

  const handleDeleteClick = useCallback(
    async (entryId: string) => {
      if (!confirm("Delete this entry?")) return;
      try {
        const res = await fetch(`/api/systems/${assessmentId}/data-inventory/${entryId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setEntries((prev) => prev.filter((e) => e.id !== entryId));
        } else {
          alert("Failed to delete");
        }
      } catch (e) {
        alert(e instanceof Error ? e.message : "Error deleting");
      }
    },
    [assessmentId]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        data_type: formData.data_type,
        classification: formData.classification,
        residency: formData.residency,
        volume_estimate: formData.volume_estimate || null,
        retention_days: formData.retention_days ? parseInt(formData.retention_days) : null,
        source_description: formData.source_description || null,
        processor: formData.processor || null,
      };

      let res;
      if (editingEntry) {
        res = await fetch(`/api/systems/${assessmentId}/data-inventory/${editingEntry.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/systems/${assessmentId}/data-inventory`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        alert(`Error: ${data.error}`);
        return;
      }

      const data = await res.json();
      if (editingEntry) {
        setEntries((prev) =>
          prev.map((e) => (e.id === editingEntry.id ? data.entry : e))
        );
      } else {
        setEntries((prev) => [data.entry, ...prev]);
      }

      setShowModal(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error saving");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        Loading data governance...
      </div>
    );
  }

  if (error || !assessment) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-destructive">
          {error || "Assessment not found"}
        </div>
        <Link href="/trustsys" className="text-sm text-brand hover:underline">
          Back to assessments
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {assessment.system_name}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Data Governance</p>
          </div>
          <button
            onClick={handleAddClick}
            className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors"
          >
            Add Entry
          </button>
        </div>
      </header>

      {/* Inventory table or empty state */}
      {entries.length === 0 ? (
        <EmptyState
          icon={<DatabaseIcon />}
          title="No data inventory recorded"
          description="Add entries to document what data your AI system processes, how it's classified, and where it's stored."
          ctaLabel="Add Entry"
          ctaAction={handleAddClick}
        />
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-foreground">
                    Data Type
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-foreground">
                    Classification
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-foreground">
                    Residency
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-foreground">
                    Retention (days)
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-foreground">
                    Processor
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 text-foreground">{entry.data_type}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                          CLASSIFICATION_COLORS[entry.classification] ||
                          "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {entry.classification.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {RESIDENCY_LABELS[entry.residency] || entry.residency}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {entry.retention_days || "—"}
                    </td>
                    <td className="px-4 py-3 text-foreground text-xs">
                      {entry.processor || "—"}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => handleEditClick(entry)}
                        className="text-xs text-brand hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteClick(entry.id)}
                        className="text-xs text-destructive hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-lg max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              {editingEntry ? "Edit Entry" : "Add Data Inventory Entry"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Data Type */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Data Type
                </label>
                <input
                  type="text"
                  required
                  value={formData.data_type}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, data_type: e.target.value }))
                  }
                  placeholder="e.g., Customer Names, Email Addresses"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:border-brand"
                />
              </div>

              {/* Classification */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Classification
                </label>
                <select
                  value={formData.classification}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      classification: e.target.value as typeof formData.classification,
                    }))
                  }
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:border-brand"
                >
                  <option value="none">None</option>
                  <option value="public">Public</option>
                  <option value="internal">Internal</option>
                  <option value="confidential">Confidential</option>
                  <option value="pii">PII</option>
                  <option value="sensitive_pii">Sensitive PII</option>
                  <option value="phi">PHI</option>
                  <option value="financial">Financial</option>
                </select>
              </div>

              {/* Residency */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Data Residency
                </label>
                <select
                  value={formData.residency}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      residency: e.target.value as typeof formData.residency,
                    }))
                  }
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:border-brand"
                >
                  <option value="unknown">Unknown</option>
                  <option value="uk">United Kingdom</option>
                  <option value="eu">European Union</option>
                  <option value="us">United States</option>
                  <option value="apac">Asia Pacific</option>
                  <option value="global">Global</option>
                </select>
              </div>

              {/* Retention Days */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Retention (days)
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.retention_days}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, retention_days: e.target.value }))
                  }
                  placeholder="e.g., 90"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:border-brand"
                />
              </div>

              {/* Source Description */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Source Description
                </label>
                <input
                  type="text"
                  value={formData.source_description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      source_description: e.target.value,
                    }))
                  }
                  placeholder="e.g., CRM system, user forms"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:border-brand"
                />
              </div>

              {/* Processor */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Processor
                </label>
                <input
                  type="text"
                  value={formData.processor}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, processor: e.target.value }))
                  }
                  placeholder="e.g., AWS S3, Google Cloud"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:border-brand"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-border text-foreground text-sm font-medium hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors disabled:opacity-50"
                >
                  {submitting ? "Saving..." : editingEntry ? "Update" : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function DatabaseIcon() {
  return (
    <svg
      className="w-full h-full"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
      />
    </svg>
  );
}
