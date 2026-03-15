"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AuthenticatedShell from "@/components/AuthenticatedShell";
import RequireAuth from "@/components/RequireAuth";
import type {
  IBGSpecification,
  AuthorisedGoal,
  DecisionAuthority,
  ActionSpace,
  BlastRadius,
} from "@/lib/ibgTypes";
import {
  GOAL_CATEGORIES,
  ACTION_TYPES,
  DATA_SCOPE_OPTIONS,
  GEOGRAPHIC_SCOPE_OPTIONS,
  FINANCIAL_PERIODS,
  EMPTY_BLAST_RADIUS,
  checkIBGCompleteness,
} from "@/lib/ibgTypes";

// ---------------------------------------------------------------------------
// IBG Specification Editor
// ---------------------------------------------------------------------------

export default function IBGPage() {
  return (
    <RequireAuth>
      <AuthenticatedShell>
        <IBGEditor />
      </AuthenticatedShell>
    </RequireAuth>
  );
}

const EMPTY_GOAL: AuthorisedGoal = {
  goal: "",
  category: "operational",
  priority: "primary",
  rationale: "",
};

const EMPTY_AUTHORITY: DecisionAuthority = {
  authority: "",
  scope: "",
  constraints: [],
  requires_human_approval: false,
  threshold_description: "",
};

const EMPTY_ACTION: ActionSpace = {
  action_type: "api_call",
  permitted: true,
  conditions: "",
  api_scope: "",
};

function IBGEditor() {
  const params = useParams();
  const assessmentId = params.assessmentId as string;

  const [spec, setSpec] = useState<IBGSpecification | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form state
  const [goals, setGoals] = useState<AuthorisedGoal[]>([{ ...EMPTY_GOAL }]);
  const [authorities, setAuthorities] = useState<DecisionAuthority[]>([]);
  const [actions, setActions] = useState<ActionSpace[]>([]);
  const [blastRadius, setBlastRadius] = useState<BlastRadius>({ ...EMPTY_BLAST_RADIUS });

  const isReadOnly = spec?.status === "active" || spec?.status === "superseded";

  // Load existing spec
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/ibg/${assessmentId}`);
        if (!res.ok) {
          if (res.status === 404) return; // No spec yet
          const d = await res.json();
          throw new Error(d.error || "Failed to load IBG spec");
        }
        const d = await res.json();
        if (d.spec) {
          const s = d.spec as IBGSpecification;
          setSpec(s);
          setGoals(s.authorised_goals.length > 0 ? s.authorised_goals : [{ ...EMPTY_GOAL }]);
          setAuthorities(s.decision_authorities);
          setActions(s.action_spaces);
          setBlastRadius(s.blast_radius || { ...EMPTY_BLAST_RADIUS });
        }
      } catch (e: unknown) {
        setMessage({ type: "error", text: e instanceof Error ? e.message : "Failed to load" });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [assessmentId]);

  const clearMessage = useCallback(() => {
    setTimeout(() => setMessage(null), 4000);
  }, []);

  // Save draft
  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const body = {
        authorised_goals: goals.filter((g) => g.goal.trim()),
        decision_authorities: authorities.filter((a) => a.authority.trim()),
        action_spaces: actions.filter((a) => a.conditions.trim() || a.api_scope.trim() || true),
        blast_radius: blastRadius,
      };

      const method = spec ? "PUT" : "POST";
      const payload = spec ? { ...body, id: spec.id } : body;

      const res = await fetch(`/api/ibg/${assessmentId}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to save");

      setSpec(d.spec);
      setMessage({ type: "success", text: "Draft saved" });
      clearMessage();
    } catch (e: unknown) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Failed to save" });
    } finally {
      setSaving(false);
    }
  }

  // Activate
  async function handleActivate() {
    if (!spec) return;
    setActivating(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/ibg/${assessmentId}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: spec.id }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to activate");

      setSpec(d.spec);
      setMessage({ type: "success", text: "IBG specification activated" });
      clearMessage();
    } catch (e: unknown) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Failed to activate" });
    } finally {
      setActivating(false);
    }
  }

  // Create new version from active spec
  async function handleNewVersion() {
    setSaving(true);
    setMessage(null);
    try {
      const body = {
        authorised_goals: goals,
        decision_authorities: authorities,
        action_spaces: actions,
        blast_radius: blastRadius,
      };
      const res = await fetch(`/api/ibg/${assessmentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to create new version");

      setSpec(d.spec);
      setMessage({ type: "success", text: "New draft version created" });
      clearMessage();
    } catch (e: unknown) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Failed to create version" });
    } finally {
      setSaving(false);
    }
  }

  const completeness = checkIBGCompleteness(spec);
  const canActivate = spec?.status === "draft" && goals.some((g) => g.goal.trim());

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-12">
        <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        Loading IBG specification...
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      {/* Navigation */}
      <Link
        href="/trustsys"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 inline-flex items-center gap-1"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to systems
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-6 mt-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-brand/10 text-brand">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-foreground">
              Intent-Based Governance&trade;
            </h1>
          </div>
          {spec && (
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                spec.status === "active"
                  ? "bg-green-100 text-green-800"
                  : spec.status === "draft"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-gray-100 text-gray-600"
              }`}>
                {spec.status === "active" ? "Active" : spec.status === "draft" ? "Draft" : spec.status}
              </span>
              <span className="text-xs text-muted-foreground">v{spec.version}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {isReadOnly ? (
            <button
              type="button"
              onClick={handleNewVersion}
              disabled={saving}
              className="px-4 py-2 bg-brand text-white font-medium rounded-lg hover:bg-brand/90 transition-colors text-sm disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create new version"}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 border border-border text-foreground font-medium rounded-lg hover:bg-gray-100 transition-colors text-sm disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Draft"}
              </button>
              <button
                type="button"
                onClick={handleActivate}
                disabled={!canActivate || activating}
                className="px-4 py-2 bg-brand text-white font-medium rounded-lg hover:bg-brand/90 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {activating ? "Activating..." : "Activate"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${
          message.type === "success"
            ? "bg-green-50 text-green-800 border border-green-200"
            : "bg-red-50 text-red-800 border border-red-200"
        }`}>
          {message.text}
        </div>
      )}

      {/* Completeness indicator */}
      {spec && (
        <div className="flex items-center gap-4 mb-6 text-xs">
          <span className="text-muted-foreground font-medium">Completeness:</span>
          <span className={completeness.goals ? "text-green-600" : "text-muted-foreground"}>
            {completeness.goals ? "\u2713" : "\u2717"} Goals
          </span>
          <span className={completeness.authorities ? "text-green-600" : "text-muted-foreground"}>
            {completeness.authorities ? "\u2713" : "\u2717"} Authorities
          </span>
          <span className={completeness.blastRadius ? "text-green-600" : "text-muted-foreground"}>
            {completeness.blastRadius ? "\u2713" : "\u2717"} Blast Radius
          </span>
        </div>
      )}

      {/* Panel 1: Authorised Goals */}
      <section className="border border-border rounded-xl p-5 mb-4">
        <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">
          1. Authorised Goals
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Define what this system is allowed to pursue. At least one goal is required to activate.
        </p>
        <div className="space-y-4">
          {goals.map((g, i) => (
            <div key={i} className="border border-border/60 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-foreground mb-1">Goal</label>
                  <input
                    type="text"
                    value={g.goal}
                    disabled={isReadOnly}
                    onChange={(e) => {
                      const next = [...goals];
                      next[i] = { ...next[i], goal: e.target.value };
                      setGoals(next);
                    }}
                    placeholder="e.g. Respond to customer queries about product features"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent disabled:bg-gray-50 disabled:text-muted-foreground"
                  />
                </div>
                {!isReadOnly && goals.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setGoals(goals.filter((_, j) => j !== i))}
                    className="mt-5 text-muted-foreground hover:text-destructive text-xs"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Category</label>
                  <select
                    value={g.category}
                    disabled={isReadOnly}
                    onChange={(e) => {
                      const next = [...goals];
                      next[i] = { ...next[i], category: e.target.value as AuthorisedGoal["category"] };
                      setGoals(next);
                    }}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white disabled:bg-gray-50"
                  >
                    {GOAL_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Priority</label>
                  <select
                    value={g.priority}
                    disabled={isReadOnly}
                    onChange={(e) => {
                      const next = [...goals];
                      next[i] = { ...next[i], priority: e.target.value as AuthorisedGoal["priority"] };
                      setGoals(next);
                    }}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white disabled:bg-gray-50"
                  >
                    <option value="primary">Primary</option>
                    <option value="secondary">Secondary</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Rationale</label>
                  <input
                    type="text"
                    value={g.rationale}
                    disabled={isReadOnly}
                    onChange={(e) => {
                      const next = [...goals];
                      next[i] = { ...next[i], rationale: e.target.value };
                      setGoals(next);
                    }}
                    placeholder="Why this goal is authorised"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent disabled:bg-gray-50"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        {!isReadOnly && (
          <button
            type="button"
            onClick={() => setGoals([...goals, { ...EMPTY_GOAL }])}
            className="mt-3 text-xs text-brand hover:text-brand/80 font-medium"
          >
            + Add goal
          </button>
        )}
      </section>

      {/* Panel 2: Decision Authorities & Action Spaces */}
      <section className="border border-border rounded-xl p-5 mb-4">
        <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">
          2. Decision Authorities &amp; Action Spaces
        </h2>

        {/* Decision Authorities */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-foreground mb-2">Decision Authorities</h3>
          <p className="text-xs text-muted-foreground mb-3">
            What decisions is this system permitted to make?
          </p>
          <div className="space-y-3">
            {authorities.map((a, i) => (
              <div key={i} className="border border-border/60 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Authority</label>
                      <input
                        type="text"
                        value={a.authority}
                        disabled={isReadOnly}
                        onChange={(e) => {
                          const next = [...authorities];
                          next[i] = { ...next[i], authority: e.target.value };
                          setAuthorities(next);
                        }}
                        placeholder="e.g. Product recommendation"
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent disabled:bg-gray-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Scope</label>
                      <input
                        type="text"
                        value={a.scope}
                        disabled={isReadOnly}
                        onChange={(e) => {
                          const next = [...authorities];
                          next[i] = { ...next[i], scope: e.target.value };
                          setAuthorities(next);
                        }}
                        placeholder="e.g. Consumer products only"
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent disabled:bg-gray-50"
                      />
                    </div>
                  </div>
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => setAuthorities(authorities.filter((_, j) => j !== i))}
                      className="mt-5 text-muted-foreground hover:text-destructive text-xs"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Constraints <span className="text-muted-foreground font-normal">(comma-separated)</span>
                    </label>
                    <input
                      type="text"
                      value={a.constraints.join(", ")}
                      disabled={isReadOnly}
                      onChange={(e) => {
                        const next = [...authorities];
                        next[i] = {
                          ...next[i],
                          constraints: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                        };
                        setAuthorities(next);
                      }}
                      placeholder="e.g. Max 3 items, UK catalogue only"
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent disabled:bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Threshold</label>
                    <input
                      type="text"
                      value={a.threshold_description}
                      disabled={isReadOnly}
                      onChange={(e) => {
                        const next = [...authorities];
                        next[i] = { ...next[i], threshold_description: e.target.value };
                        setAuthorities(next);
                      }}
                      placeholder="When does this need escalation?"
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent disabled:bg-gray-50"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={a.requires_human_approval}
                    disabled={isReadOnly}
                    onChange={(e) => {
                      const next = [...authorities];
                      next[i] = { ...next[i], requires_human_approval: e.target.checked };
                      setAuthorities(next);
                    }}
                    className="rounded border-border"
                  />
                  <span className="text-foreground">Requires human approval</span>
                </label>
              </div>
            ))}
          </div>
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => setAuthorities([...authorities, { ...EMPTY_AUTHORITY }])}
              className="mt-3 text-xs text-brand hover:text-brand/80 font-medium"
            >
              + Add decision authority
            </button>
          )}
        </div>

        {/* Action Spaces */}
        <div>
          <h3 className="text-xs font-semibold text-foreground mb-2">Action Spaces</h3>
          <p className="text-xs text-muted-foreground mb-3">
            What actions can this system perform?
          </p>
          <div className="space-y-3">
            {actions.map((a, i) => (
              <div key={i} className="border border-border/60 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 grid grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Action Type</label>
                      <select
                        value={a.action_type}
                        disabled={isReadOnly}
                        onChange={(e) => {
                          const next = [...actions];
                          next[i] = { ...next[i], action_type: e.target.value as ActionSpace["action_type"] };
                          setActions(next);
                        }}
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white disabled:bg-gray-50"
                      >
                        {ACTION_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Conditions</label>
                      <input
                        type="text"
                        value={a.conditions}
                        disabled={isReadOnly}
                        onChange={(e) => {
                          const next = [...actions];
                          next[i] = { ...next[i], conditions: e.target.value };
                          setActions(next);
                        }}
                        placeholder="Under what conditions"
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent disabled:bg-gray-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">API Scope</label>
                      <input
                        type="text"
                        value={a.api_scope}
                        disabled={isReadOnly}
                        onChange={(e) => {
                          const next = [...actions];
                          next[i] = { ...next[i], api_scope: e.target.value };
                          setActions(next);
                        }}
                        placeholder="e.g. read-only"
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent disabled:bg-gray-50"
                      />
                    </div>
                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={a.permitted}
                          disabled={isReadOnly}
                          onChange={(e) => {
                            const next = [...actions];
                            next[i] = { ...next[i], permitted: e.target.checked };
                            setActions(next);
                          }}
                          className="rounded border-border"
                        />
                        <span className="text-foreground">Permitted</span>
                      </label>
                    </div>
                  </div>
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => setActions(actions.filter((_, j) => j !== i))}
                      className="mt-5 text-muted-foreground hover:text-destructive text-xs"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => setActions([...actions, { ...EMPTY_ACTION }])}
              className="mt-3 text-xs text-brand hover:text-brand/80 font-medium"
            >
              + Add action space
            </button>
          )}
        </div>
      </section>

      {/* Panel 3: Blast Radius Constraints */}
      <section className="border border-border rounded-xl p-5 mb-4">
        <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">
          3. Blast Radius Constraints
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Define how far this system&apos;s effects can propagate.
        </p>

        <div className="space-y-4">
          {/* Entity scope */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Entity Scope</label>
            <input
              type="text"
              value={blastRadius.entity_scope}
              disabled={isReadOnly}
              onChange={(e) => setBlastRadius({ ...blastRadius, entity_scope: e.target.value })}
              placeholder="e.g. Individual customer accounts only"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent disabled:bg-gray-50"
            />
          </div>

          {/* Financial scope */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Financial Scope</label>
            <div className="grid grid-cols-3 gap-3">
              <input
                type="number"
                value={blastRadius.financial_scope.max_value ?? ""}
                disabled={isReadOnly}
                onChange={(e) =>
                  setBlastRadius({
                    ...blastRadius,
                    financial_scope: {
                      ...blastRadius.financial_scope,
                      max_value: e.target.value ? Number(e.target.value) : null,
                    },
                  })
                }
                placeholder="Max value"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent disabled:bg-gray-50"
              />
              <input
                type="text"
                value={blastRadius.financial_scope.currency}
                disabled={isReadOnly}
                onChange={(e) =>
                  setBlastRadius({
                    ...blastRadius,
                    financial_scope: { ...blastRadius.financial_scope, currency: e.target.value },
                  })
                }
                placeholder="Currency"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent disabled:bg-gray-50"
              />
              <select
                value={blastRadius.financial_scope.period}
                disabled={isReadOnly}
                onChange={(e) =>
                  setBlastRadius({
                    ...blastRadius,
                    financial_scope: {
                      ...blastRadius.financial_scope,
                      period: e.target.value as BlastRadius["financial_scope"]["period"],
                    },
                  })
                }
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white disabled:bg-gray-50"
              >
                {FINANCIAL_PERIODS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Data scope */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Data Scope</label>
            <div className="flex flex-wrap gap-2">
              {DATA_SCOPE_OPTIONS.map((opt) => (
                <label key={opt} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={blastRadius.data_scope.includes(opt)}
                    disabled={isReadOnly}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...blastRadius.data_scope, opt]
                        : blastRadius.data_scope.filter((s) => s !== opt);
                      setBlastRadius({ ...blastRadius, data_scope: next });
                    }}
                    className="rounded border-border"
                  />
                  <span className="text-foreground">{opt}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Temporal scope */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Temporal Scope</label>
            <input
              type="text"
              value={blastRadius.temporal_scope}
              disabled={isReadOnly}
              onChange={(e) => setBlastRadius({ ...blastRadius, temporal_scope: e.target.value })}
              placeholder="e.g. Real-time only, no historical data modification"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent disabled:bg-gray-50"
            />
          </div>

          {/* Cascade scope */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Cascade Scope</label>
            <input
              type="text"
              value={blastRadius.cascade_scope}
              disabled={isReadOnly}
              onChange={(e) => setBlastRadius({ ...blastRadius, cascade_scope: e.target.value })}
              placeholder="e.g. No downstream system triggers"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent disabled:bg-gray-50"
            />
          </div>

          {/* Max affected users */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Max Affected Users</label>
            <input
              type="number"
              value={blastRadius.max_affected_users ?? ""}
              disabled={isReadOnly}
              onChange={(e) =>
                setBlastRadius({
                  ...blastRadius,
                  max_affected_users: e.target.value ? Number(e.target.value) : null,
                })
              }
              placeholder="Maximum number of users affected"
              className="w-full max-w-xs px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent disabled:bg-gray-50"
            />
          </div>

          {/* Geographic scope */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Geographic Scope</label>
            <div className="flex flex-wrap gap-2">
              {GEOGRAPHIC_SCOPE_OPTIONS.map((opt) => (
                <label key={opt} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={blastRadius.geographic_scope.includes(opt)}
                    disabled={isReadOnly}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...blastRadius.geographic_scope, opt]
                        : blastRadius.geographic_scope.filter((s) => s !== opt);
                      setBlastRadius({ ...blastRadius, geographic_scope: next });
                    }}
                    className="rounded border-border"
                  />
                  <span className="text-foreground">{opt}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
