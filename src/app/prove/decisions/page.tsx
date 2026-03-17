"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TierGate from "@/components/TierGate";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import DetailPanel from "@/components/ui/DetailPanel";
import { showActionToast } from "@/components/ui/Toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DecisionRecord = {
  id: string;
  organisation_id: string;
  system_id: string;
  ai_output_id: string;
  policy_version_id: string;
  human_reviewer_id: string | null;
  source_type: string;
  review_mode: string;
  decision_status: string;
  human_decision: string | null;
  human_rationale: string | null;
  reviewed_at: string | null;
  verification_id: string | null;
  event_hash: string | null;
  chain_tx_hash: string | null;
  chain_status: string;
  anchored_at: string | null;
  created_at: string;
  assurance_grade: string | null;
  oversight_mode: string | null;
  systems: { name: string } | null;
  profiles: { full_name: string } | null;
  policy_versions: { title: string; version: number } | null;
  ai_outputs: { output_summary: string; output_type: string | null } | null;
};

type AiOutputContext = {
  input_summary?: string;
  notes?: string;
  supporting_evidence?: string[];
  full_output_ref?: string;
};

type DecisionDetail = DecisionRecord & {
  ai_outputs: {
    output_summary: string;
    output_type: string | null;
    output_hash: string;
    confidence_score: number | null;
    risk_signal: string | null;
    occurred_at: string;
    model_id: string | null;
    context: AiOutputContext | null;
  } | null;
  policy_versions: { title: string; version: number; policy_hash: string; status: string } | null;
  profiles: { full_name: string; email: string } | null;
  prove_approvals: { title: string; status: string } | null;
  prove_provenance: { title: string; verification_id: string } | null;
  model: { model_name: string; model_version: string; provider: string | null } | null;
};

type SystemOption = { id: string; name: string };
type PolicyVersionOption = { id: string; title: string; version: number };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DECISION_COLOURS: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  escalated: "bg-amber-100 text-amber-800",
  modified: "bg-blue-100 text-blue-800",
};

const STATUS_COLOURS: Record<string, string> = {
  pending_review: "bg-amber-100 text-amber-800",
  in_review: "bg-blue-100 text-blue-800",
  review_completed: "bg-green-100 text-green-800",
  anchoring_pending: "bg-amber-100 text-amber-800",
  anchored: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

const SOURCE_COLOURS: Record<string, string> = {
  manual: "bg-gray-100 text-gray-700",
  api: "bg-blue-100 text-blue-800",
};

const GRADE_COLOURS: Record<string, string> = {
  gold: "bg-amber-100 text-amber-800",
  silver: "bg-slate-100 text-slate-700",
  bronze: "bg-orange-100 text-orange-800",
};

const OVERSIGHT_COLOURS: Record<string, string> = {
  in_the_loop: "bg-blue-100 text-blue-800",
  on_the_loop: "bg-purple-100 text-purple-800",
};

const CHAIN_COLOURS: Record<string, string> = {
  anchored: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-800",
  skipped: "bg-gray-100 text-gray-600",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatType(type: string | null): string {
  if (!type) return "\u2014";
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const headerIcon = (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DecisionLedgerPage() {
  // List state
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Filters
  const [systemFilter, setSystemFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [decisionFilter, setDecisionFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");

  // Review form state
  const [reviewDecision, setReviewDecision] = useState("approved");
  const [reviewRationale, setReviewRationale] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Systems list for filter + form
  const [systems, setSystems] = useState<SystemOption[]>([]);

  // Detail panel
  const [selected, setSelected] = useState<DecisionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<"decision" | "chain">("decision");
  const [anchoring, setAnchoring] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formSystem, setFormSystem] = useState("");
  const [formModel, setFormModel] = useState("");
  const [formModels, setFormModels] = useState<{ id: string; model_name: string; model_version: string }[]>([]);
  const [formSummary, setFormSummary] = useState("");
  const [formOutputType, setFormOutputType] = useState("");
  const [formConfidence, setFormConfidence] = useState("");
  const [formRiskSignal, setFormRiskSignal] = useState("");
  const [formPolicyVersion, setFormPolicyVersion] = useState("");
  const [formPolicyVersions, setFormPolicyVersions] = useState<PolicyVersionOption[]>([]);
  const [formReviewMode, setFormReviewMode] = useState("required");
  const [formDecision, setFormDecision] = useState("approved");
  const [formRationale, setFormRationale] = useState("");

  // Fetch systems for filter/form
  useEffect(() => {
    fetch("/api/risk-registry")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.data) setSystems(d.data.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
      });
  }, []);

  // Fetch active policy versions for form
  useEffect(() => {
    fetch("/api/happ/policy-versions?status=active&per_page=100")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.records) setFormPolicyVersions(d.records.map((pv: PolicyVersionOption) => ({ id: pv.id, title: pv.title, version: pv.version })));
      });
  }, []);

  // Fetch models when system changes in form
  useEffect(() => {
    if (!formSystem) { setFormModels([]); return; }
    fetch(`/api/model-registry?system_id=${formSystem}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.models) setFormModels(d.models);
        else setFormModels([]);
      });
  }, [formSystem]);

  // Fetch decisions
  const fetchDecisions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
      if (systemFilter) params.set("system_id", systemFilter);
      if (statusFilter) params.set("decision_status", statusFilter);
      if (decisionFilter) params.set("human_decision", decisionFilter);
      if (sourceFilter) params.set("source_type", sourceFilter);
      if (gradeFilter) params.set("assurance_grade", gradeFilter);

      const res = await fetch(`/api/happ/decisions?${params}`);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to load decisions");
      }
      const d = await res.json();
      setDecisions(d.records ?? []);
      setTotal(d.total ?? 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load decisions");
    } finally {
      setLoading(false);
    }
  }, [page, systemFilter, statusFilter, decisionFilter, sourceFilter, gradeFilter]);

  useEffect(() => { fetchDecisions(); }, [fetchDecisions]);
  useEffect(() => { setPage(1); }, [systemFilter, statusFilter, decisionFilter, sourceFilter, gradeFilter]);

  // Fetch detail
  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setDetailTab("decision");
    try {
      const res = await fetch(`/api/happ/decisions/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelected(data);
      }
    } finally {
      setDetailLoading(false);
    }
  };

  // Anchor decision
  const anchorDecision = async () => {
    if (!selected) return;
    setAnchoring(true);
    try {
      const res = await fetch(`/api/happ/decisions/${selected.id}/anchor`, { method: "POST" });
      if (res.ok) {
        const result = await res.json();
        setSelected((prev) => prev ? { ...prev, ...result, chain_status: result.chain_status, decision_status: result.chain_status === "anchored" ? "anchored" : prev.decision_status } : null);
        showActionToast(result.chain_status === "anchored" ? "Decision anchored on chain" : "Anchoring failed");
        fetchDecisions();
      }
    } finally {
      setAnchoring(false);
    }
  };

  // Submit form
  const handleSubmit = async () => {
    if (!formSystem || !formSummary || !formPolicyVersion) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        system_id: formSystem,
        output_summary: formSummary,
        occurred_at: new Date().toISOString(),
        policy_version_id: formPolicyVersion,
        review_mode: formReviewMode,
        human_decision: formDecision,
      };
      if (formModel) body.model_id = formModel;
      if (formOutputType) body.output_type = formOutputType;
      if (formConfidence) body.confidence_score = parseFloat(formConfidence);
      if (formRiskSignal) body.risk_signal = formRiskSignal;
      if (formRationale) body.human_rationale = formRationale;

      const res = await fetch("/api/happ/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to record decision");
      }
      showActionToast("Decision recorded");
      setShowForm(false);
      resetForm();
      fetchDecisions();
    } catch (e: unknown) {
      showActionToast(e instanceof Error ? e.message : "Failed to record decision");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormSystem("");
    setFormModel("");
    setFormSummary("");
    setFormOutputType("");
    setFormConfidence("");
    setFormRiskSignal("");
    setFormPolicyVersion("");
    setFormReviewMode("required");
    setFormDecision("approved");
    setFormRationale("");
  };

  // Submit review for pending decision
  const handleReviewSubmit = async () => {
    if (!selected) return;
    setReviewSubmitting(true);
    try {
      const res = await fetch(`/api/happ/decisions/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          human_decision: reviewDecision,
          human_rationale: reviewRationale || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to submit review");
      }
      showActionToast("Review submitted");
      setReviewDecision("approved");
      setReviewRationale("");
      // Re-fetch detail and list
      await openDetail(selected.id);
      fetchDecisions();
    } catch (e: unknown) {
      showActionToast(e instanceof Error ? e.message : "Failed to submit review");
    } finally {
      setReviewSubmitting(false);
    }
  };

  // Summary stats
  const stats = useMemo(() => {
    const pending = decisions.filter((d) => d.decision_status === "pending_review").length;
    const approved = decisions.filter((d) => d.human_decision === "approved").length;
    const rejected = decisions.filter((d) => d.human_decision === "rejected").length;
    const anchored = decisions.filter((d) => d.chain_status === "anchored").length;
    return { pending, approved, rejected, anchored };
  }, [decisions]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const inputClass = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm";
  const selectClass = "px-3 py-1.5 rounded-lg border border-border bg-background text-sm";

  return (
    <TierGate requiredTier="Verify" featureLabel="Decision Ledger">
      <div className="space-y-6">
        <PageHeader
          icon={headerIcon}
          title="Decision Ledger"
          description="Human-reviewed AI decisions under policy"
          actions={
            <button
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors"
              data-tour="record-decision"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Record Decision
            </button>
          }
        />

        {/* Record Decision Form */}
        {showForm && (
          <div className="border border-border rounded-xl p-6 space-y-4 bg-muted/30">
            <h3 className="text-sm font-semibold">Record a Decision</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">System *</label>
                <select value={formSystem} onChange={(e) => setFormSystem(e.target.value)} className={inputClass}>
                  <option value="">Select system...</option>
                  {systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Model (optional)</label>
                <select value={formModel} onChange={(e) => setFormModel(e.target.value)} className={inputClass} disabled={!formSystem}>
                  <option value="">None</option>
                  {formModels.map((m) => <option key={m.id} value={m.id}>{m.model_name} {m.model_version}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Output Summary *</label>
              <textarea value={formSummary} onChange={(e) => setFormSummary(e.target.value)} className={inputClass} rows={3} placeholder="Describe the AI output being reviewed..." />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Output Type</label>
                <select value={formOutputType} onChange={(e) => setFormOutputType(e.target.value)} className={inputClass}>
                  <option value="">Select...</option>
                  <option value="recommendation">Recommendation</option>
                  <option value="classification">Classification</option>
                  <option value="generated_text">Generated Text</option>
                  <option value="action_request">Action Request</option>
                  <option value="score">Score</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Confidence (0-1)</label>
                <input type="number" step="0.01" min="0" max="1" value={formConfidence} onChange={(e) => setFormConfidence(e.target.value)} className={inputClass} placeholder="0.85" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Risk Signal</label>
                <select value={formRiskSignal} onChange={(e) => setFormRiskSignal(e.target.value)} className={inputClass}>
                  <option value="">Select...</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Policy Version *</label>
                <select value={formPolicyVersion} onChange={(e) => setFormPolicyVersion(e.target.value)} className={inputClass}>
                  <option value="">Select...</option>
                  {formPolicyVersions.map((pv) => <option key={pv.id} value={pv.id}>{pv.title} (v{pv.version})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Review Mode *</label>
                <select value={formReviewMode} onChange={(e) => setFormReviewMode(e.target.value)} className={inputClass}>
                  <option value="required">Required</option>
                  <option value="optional">Optional</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Decision *</label>
                <select value={formDecision} onChange={(e) => setFormDecision(e.target.value)} className={inputClass}>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="escalated">Escalated</option>
                  <option value="modified">Modified</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Rationale (optional)</label>
              <textarea value={formRationale} onChange={(e) => setFormRationale(e.target.value)} className={inputClass} rows={2} placeholder="Why was this decision made?" />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSubmit}
                disabled={submitting || !formSystem || !formSummary || !formPolicyVersion}
                className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors disabled:opacity-50"
              >
                {submitting ? "Recording..." : "Record Decision"}
              </button>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Total", value: total },
            { label: "Pending", value: stats.pending },
            { label: "Approved", value: stats.approved },
            { label: "Rejected", value: stats.rejected },
            { label: "Anchored", value: stats.anchored },
          ].map((s) => (
            <div key={s.label} className="border border-border rounded-xl p-4">
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{s.label}</div>
              <div className="text-2xl font-semibold mt-1">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Review Queue Banner */}
        {stats.pending > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-amber-800">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">{stats.pending} decision{stats.pending !== 1 ? "s" : ""} awaiting review</span>
            </div>
            <button
              onClick={() => setStatusFilter("pending_review")}
              className="text-xs font-medium px-3 py-1 rounded-lg bg-amber-200 text-amber-900 hover:bg-amber-300 transition-colors"
            >
              Review now
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select value={systemFilter} onChange={(e) => setSystemFilter(e.target.value)} className={selectClass}>
            <option value="">All systems</option>
            {systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
            <option value="">All statuses</option>
            <option value="pending_review">Pending Review</option>
            <option value="review_completed">Review Completed</option>
            <option value="anchored">Anchored</option>
            <option value="failed">Failed</option>
          </select>
          <select value={decisionFilter} onChange={(e) => setDecisionFilter(e.target.value)} className={selectClass}>
            <option value="">All decisions</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="escalated">Escalated</option>
            <option value="modified">Modified</option>
          </select>
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className={selectClass}>
            <option value="">All sources</option>
            <option value="manual">Manual</option>
            <option value="api">API</option>
          </select>
          <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} className={selectClass}>
            <option value="">All grades</option>
            <option value="gold">Gold</option>
            <option value="silver">Silver</option>
            <option value="bronze">Bronze</option>
          </select>
          {statusFilter !== "pending_review" && (
            <button
              onClick={() => setStatusFilter("pending_review")}
              className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm font-medium hover:bg-amber-100 transition-colors"
            >
              Pending Review
            </button>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            Loading decisions...
          </div>
        )}

        {error && <div className="text-sm text-destructive py-4">{error}</div>}

        {!loading && !error && decisions.length === 0 && (
          <EmptyState
            icon={headerIcon}
            title="No decisions recorded"
            description="Record your first human-reviewed AI decision to begin building your decision ledger."
            ctaLabel="Record Decision"
            ctaAction={() => setShowForm(true)}
          />
        )}

        {!loading && !error && decisions.length > 0 && (
          <>
            {/* Table */}
            <div className="border border-border rounded-lg overflow-hidden" data-tour="decisions-table">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">System</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Source</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Output Summary</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Reviewer</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Decision</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Grade</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Policy</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Reviewed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {decisions.map((d) => (
                    <tr key={d.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => openDetail(d.id)}>
                      <td className="px-4 py-3 font-medium">{d.systems?.name ?? "\u2014"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SOURCE_COLOURS[d.source_type] ?? "bg-gray-100 text-gray-600"}`}>
                          {d.source_type === "api" ? "API" : "Manual"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{d.ai_outputs?.output_summary ?? "\u2014"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{d.profiles?.full_name ?? "\u2014"}</td>
                      <td className="px-4 py-3">
                        {d.human_decision ? (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${DECISION_COLOURS[d.human_decision] ?? "bg-gray-100 text-gray-600"}`}>
                            {formatType(d.human_decision)}
                          </span>
                        ) : <span className="text-xs text-muted-foreground">&mdash;</span>}
                      </td>
                      <td className="px-4 py-3">
                        {d.assurance_grade ? (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${GRADE_COLOURS[d.assurance_grade] ?? "bg-gray-100 text-gray-600"}`}>
                            {d.assurance_grade.charAt(0).toUpperCase() + d.assurance_grade.slice(1)}
                          </span>
                        ) : <span className="text-xs text-muted-foreground">&mdash;</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {d.policy_versions ? `${d.policy_versions.title} v${d.policy_versions.version}` : "\u2014"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOURS[d.decision_status] ?? "bg-gray-100 text-gray-600"}`}>
                          {formatType(d.decision_status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {d.reviewed_at ? formatDate(d.reviewed_at) : "\u2014"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{total} decision{total !== 1 ? "s" : ""} total</span>
                <div className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 rounded border border-border disabled:opacity-40">Previous</button>
                  <span className="px-3 py-1 text-muted-foreground">Page {page} of {totalPages}</span>
                  <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 rounded border border-border disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Detail Panel */}
        <DetailPanel
          open={!!selected}
          onClose={() => setSelected(null)}
          title={selected?.systems?.name ?? "Decision Detail"}
          subtitle="Decision Ledger"
          badge={
            selected ? (
              <div className="flex flex-wrap gap-1.5">
                {selected.human_decision && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${DECISION_COLOURS[selected.human_decision] ?? "bg-gray-100 text-gray-600"}`}>
                    {formatType(selected.human_decision)}
                  </span>
                )}
                {selected.assurance_grade && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${GRADE_COLOURS[selected.assurance_grade] ?? "bg-gray-100 text-gray-600"}`}>
                    {selected.assurance_grade.charAt(0).toUpperCase() + selected.assurance_grade.slice(1)}
                  </span>
                )}
                {selected.oversight_mode && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${OVERSIGHT_COLOURS[selected.oversight_mode] ?? "bg-gray-100 text-gray-600"}`}>
                    {selected.oversight_mode === "in_the_loop" ? "In-the-Loop" : "On-the-Loop"}
                  </span>
                )}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SOURCE_COLOURS[selected.source_type] ?? "bg-gray-100 text-gray-600"}`}>
                  {selected.source_type === "api" ? "API" : "Manual"}
                </span>
              </div>
            ) : undefined
          }
        >
          {detailLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              Loading...
            </div>
          ) : selected ? (
            <div className="space-y-5">
              {/* Tabs */}
              <div className="flex gap-1 border-b border-border">
                <button
                  onClick={() => setDetailTab("decision")}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    detailTab === "decision" ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Decision
                </button>
                <button
                  onClick={() => setDetailTab("chain")}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    detailTab === "chain" ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Chain
                </button>
              </div>

              {detailTab === "decision" ? (
                <div className="space-y-4">
                  {/* Output details */}
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Output Summary</dt>
                    <dd className="text-sm">{selected.ai_outputs?.output_summary ?? "\u2014"}</dd>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Output Type</dt>
                      <dd>
                        {selected.ai_outputs?.output_type ? (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">{formatType(selected.ai_outputs.output_type)}</span>
                        ) : <span className="text-sm text-muted-foreground">{"\u2014"}</span>}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Confidence</dt>
                      <dd className="text-sm">{selected.ai_outputs?.confidence_score !== null && selected.ai_outputs?.confidence_score !== undefined ? selected.ai_outputs.confidence_score : "\u2014"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Risk Signal</dt>
                      <dd className="text-sm">{selected.ai_outputs?.risk_signal ? formatType(selected.ai_outputs.risk_signal) : "\u2014"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Model</dt>
                      <dd className="text-sm">
                        {selected.model ? `${selected.model.model_name} ${selected.model.model_version}` : "\u2014"}
                      </dd>
                    </div>
                  </div>

                  {/* Human decision */}
                  <div className="border-t border-border pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Decision</dt>
                        <dd>
                          {selected.human_decision ? (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${DECISION_COLOURS[selected.human_decision] ?? "bg-gray-100 text-gray-600"}`}>
                              {formatType(selected.human_decision)}
                            </span>
                          ) : "\u2014"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Review Mode</dt>
                        <dd className="text-sm">{formatType(selected.review_mode)}</dd>
                      </div>
                    </div>
                  </div>
                  {selected.human_rationale && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Rationale</dt>
                      <dd className="text-sm">{selected.human_rationale}</dd>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Policy Version</dt>
                      <dd className="text-sm">
                        {selected.policy_versions ? `${selected.policy_versions.title} v${selected.policy_versions.version}` : "\u2014"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Reviewer</dt>
                      <dd className="text-sm">{selected.profiles?.full_name ?? "\u2014"}</dd>
                    </div>
                  </div>

                  {/* Context Section */}
                  {selected.ai_outputs?.context && (
                    <div className="border-t border-border pt-4 space-y-3">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Context</h4>
                      {selected.ai_outputs.context.input_summary && (
                        <div>
                          <dt className="text-xs font-medium text-muted-foreground mb-1">Input Summary</dt>
                          <dd className="text-sm">{selected.ai_outputs.context.input_summary}</dd>
                        </div>
                      )}
                      {selected.ai_outputs.context.notes && (
                        <div>
                          <dt className="text-xs font-medium text-muted-foreground mb-1">Notes</dt>
                          <dd className="text-sm">{selected.ai_outputs.context.notes}</dd>
                        </div>
                      )}
                      {selected.ai_outputs.context.supporting_evidence && selected.ai_outputs.context.supporting_evidence.length > 0 && (
                        <div>
                          <dt className="text-xs font-medium text-muted-foreground mb-1">Supporting Evidence</dt>
                          <dd className="text-sm space-y-1">
                            {selected.ai_outputs.context.supporting_evidence.map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block text-brand hover:underline truncate">
                                {url}
                              </a>
                            ))}
                          </dd>
                        </div>
                      )}
                      {selected.ai_outputs.context.full_output_ref && (
                        <div>
                          <dt className="text-xs font-medium text-muted-foreground mb-1">Full Output</dt>
                          <dd className="text-sm">
                            <a href={selected.ai_outputs.context.full_output_ref} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                              {selected.ai_outputs.context.full_output_ref}
                            </a>
                          </dd>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Review Form for Pending Decisions */}
                  {selected.decision_status === "pending_review" && (
                    <div className="border-t border-border pt-4 space-y-3">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Review This Decision</h4>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-2">Decision</label>
                        <div className="flex flex-wrap gap-3">
                          {(["approved", "rejected", "escalated", "modified"] as const).map((opt) => (
                            <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                              <input
                                type="radio"
                                name="reviewDecision"
                                value={opt}
                                checked={reviewDecision === opt}
                                onChange={(e) => setReviewDecision(e.target.value)}
                                className="accent-brand"
                              />
                              {formatType(opt)}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Rationale (optional)</label>
                        <textarea
                          value={reviewRationale}
                          onChange={(e) => setReviewRationale(e.target.value)}
                          className={inputClass}
                          rows={2}
                          placeholder="Why was this decision made?"
                        />
                      </div>
                      <button
                        onClick={handleReviewSubmit}
                        disabled={reviewSubmitting}
                        className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors disabled:opacity-50"
                      >
                        {reviewSubmitting ? "Submitting..." : "Submit Review"}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Chain tab */
                <div className="space-y-4">
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Verification ID</dt>
                    <dd className="text-sm font-mono bg-muted/50 px-2 py-1 rounded">{selected.verification_id ?? "\u2014"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Event Hash</dt>
                    <dd className="text-sm font-mono bg-muted/50 px-2 py-1 rounded break-all">{selected.event_hash ?? "\u2014"}</dd>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Chain Status</dt>
                      <dd>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CHAIN_COLOURS[selected.chain_status] ?? "bg-gray-100 text-gray-600"}`}>
                          {formatType(selected.chain_status)}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Anchored At</dt>
                      <dd className="text-sm">{selected.anchored_at ? formatDate(selected.anchored_at) : "\u2014"}</dd>
                    </div>
                  </div>
                  {selected.chain_tx_hash && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Transaction Hash</dt>
                      <dd className="text-sm font-mono bg-muted/50 px-2 py-1 rounded break-all">{selected.chain_tx_hash}</dd>
                    </div>
                  )}
                  {selected.chain_status === "pending" && (
                    <button
                      onClick={anchorDecision}
                      disabled={anchoring}
                      className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors disabled:opacity-50"
                    >
                      {anchoring ? "Anchoring..." : "Anchor on Chain"}
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </DetailPanel>
      </div>
    </TierGate>
  );
}
