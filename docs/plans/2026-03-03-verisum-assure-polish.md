# Phase 6: Assure Polish (Monitor Section) — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the four Monitor placeholder pages with functional dashboards that surface existing drift, escalation, incident, and declaration data. The APIs already exist and are tier-gated — this phase is pure frontend.

**Architecture:** Each Monitor page becomes a `"use client"` component that fetches from the existing API, displays data in a table/list with filters, and wraps the whole thing in `TierGate` so Core users see an upgrade prompt instead. The incidents and declarations pages reuse the existing Copilot components (`IncidentLog`, declaration section) directly — no need to duplicate logic. Navigation config is updated to mark all four pages as `exists: true`.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS, inline SVGs (no lucide-react)

---

## Task 1: Drift & Alerts Page

**Files:**
- Modify: `src/app/monitor/drift/page.tsx`

Replace the TierPlaceholder with a functional client component that:

1. Wraps content in `TierGate` with `requiredTier="Assure"` and `featureLabel="Drift & Alerts"`
2. Fetches from `/api/trustgraph/drift` with filters for `run_type` and `days`
3. Shows a table of drift events with columns: Date, Type (org/sys), Score Delta, Drift Flag, Run ID
4. Includes filter controls: run type dropdown (All/Org/Sys), days lookback (30/60/90/180/365)
5. Supports pagination
6. Shows an empty state when no drift events exist
7. Uses the same badge colour pattern as the escalation severities

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import TierGate from "@/components/TierGate";

type DriftEvent = {
  id: string;
  run_id: string;
  run_type: "org" | "sys";
  delta_score: number;
  drift_flag: boolean;
  created_at: string;
};

export default function DriftPage() {
  const [events, setEvents] = useState<DriftEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [runType, setRunType] = useState<string>("");
  const [days, setDays] = useState(90);
  const [page, setPage] = useState(1);
  const perPage = 20;

  const fetchDrift = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        days: String(days),
        page: String(page),
        per_page: String(perPage),
      });
      if (runType) params.set("run_type", runType);
      const res = await fetch(`/api/trustgraph/drift?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.drift_events ?? []);
        setTotal(data.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [runType, days, page]);

  useEffect(() => { fetchDrift(); }, [fetchDrift]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <TierGate requiredTier="Assure" featureLabel="Drift & Alerts">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-brand/10 text-brand">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <polyline strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Drift & Alerts</h1>
            <p className="text-sm text-muted-foreground">Score changes detected across assessments</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select
            value={runType}
            onChange={(e) => { setRunType(e.target.value); setPage(1); }}
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
          >
            <option value="">All types</option>
            <option value="org">TrustOrg</option>
            <option value="sys">TrustSys</option>
          </select>
          <select
            value={days}
            onChange={(e) => { setDays(Number(e.target.value)); setPage(1); }}
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
          >
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
            <option value={180}>Last 180 days</option>
            <option value={365}>Last year</option>
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading drift events...</div>
        ) : events.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl p-12 text-center">
            <p className="text-sm text-muted-foreground">No drift events detected in this period</p>
          </div>
        ) : (
          <>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Score Change</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {events.map((ev) => (
                    <tr key={ev.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">{new Date(ev.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ev.run_type === "org" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"}`}>
                          {ev.run_type === "org" ? "TrustOrg" : "TrustSys"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={ev.delta_score > 0 ? "text-green-600" : "text-red-600"}>
                          {ev.delta_score > 0 ? "+" : ""}{ev.delta_score.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {ev.drift_flag ? (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-800">Drift detected</span>
                        ) : (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800">Normal</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{total} events total</span>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-1 rounded border border-border disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1 text-muted-foreground">Page {page} of {totalPages}</span>
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
    </TierGate>
  );
}
```

Commit: `git add src/app/monitor/drift/page.tsx && git commit -m "feat: build drift & alerts page with table, filters, pagination"`

---

## Task 2: Escalations Page

**Files:**
- Modify: `src/app/monitor/escalations/page.tsx`

Replace the TierPlaceholder with a functional client component that:

1. Wraps in `TierGate` with `requiredTier="Assure"`
2. Fetches from `/api/trustgraph/escalations` with filters for `resolved` and `severity`
3. Shows a table with columns: Date, Severity (badge), Status (Open/Resolved), Resolved By, Actions
4. "Resolve" button on unresolved escalations (calls POST to `/api/trustgraph/escalations`)
5. Filter controls: severity dropdown, resolved/unresolved toggle
6. Pagination support

Severity badge colours:
- low: `bg-blue-100 text-blue-800`
- medium: `bg-amber-100 text-amber-800`
- high: `bg-red-100 text-red-800`
- critical: `bg-red-200 text-red-900`

The resolve action should POST `{ escalation_id: id }` to `/api/trustgraph/escalations` and refresh the list.

Commit: `git add src/app/monitor/escalations/page.tsx && git commit -m "feat: build escalations page with severity filters and resolve action"`

---

## Task 3: Incidents Page

**Files:**
- Modify: `src/app/monitor/incidents/page.tsx`

Replace the TierPlaceholder. This page reuses the existing `IncidentLog` component from Copilot:

```tsx
"use client";

import TierGate from "@/components/TierGate";
import IncidentLog from "@/components/copilot/IncidentLog";

export default function IncidentsPage() {
  return (
    <TierGate requiredTier="Assure" featureLabel="Incidents">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-brand/10 text-brand">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <polygon strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Incidents</h1>
            <p className="text-sm text-muted-foreground">Log and track AI-related incidents</p>
          </div>
        </div>
        <IncidentLog />
      </div>
    </TierGate>
  );
}
```

Commit: `git add src/app/monitor/incidents/page.tsx && git commit -m "feat: build incidents page reusing IncidentLog component"`

---

## Task 4: Staff Declarations Page

**Files:**
- Modify: `src/app/monitor/declarations/page.tsx`

Replace the TierPlaceholder. This page needs to extract the declaration section logic from CopilotDashboard. Since the Copilot dashboard has the declaration section inline (not a separate component), create a thin wrapper that renders the declaration UI.

Read `src/components/copilot/CopilotDashboard.tsx` to find the declaration section. It contains:
- Token listing with stats
- Create token form
- Copy link / send email actions
- Invite stats per token

Extract this into a standalone usage. The simplest approach: create a new component `src/components/monitor/DeclarationManager.tsx` that contains the declaration management logic extracted from CopilotDashboard. It should:

1. Fetch declaration tokens and stats from `/api/declarations`
2. Show a list of tokens with invite/submission counts
3. Create new tokens
4. Copy shareable links
5. Send email invitations

Then the page uses it:

```tsx
"use client";

import TierGate from "@/components/TierGate";
import DeclarationManager from "@/components/monitor/DeclarationManager";

export default function DeclarationsPage() {
  return (
    <TierGate requiredTier="Assure" featureLabel="Staff Declarations">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-brand/10 text-brand">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2m16 6l2 2 4-4M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Staff Declarations</h1>
            <p className="text-sm text-muted-foreground">Manage AI usage declaration campaigns</p>
          </div>
        </div>
        <DeclarationManager />
      </div>
    </TierGate>
  );
}
```

For the `DeclarationManager` component, extract the declaration logic from `CopilotDashboard.tsx` into its own file. This should include:
- Token list with invite stats
- Create token form (label input + create button)
- Copy link button per token
- Send email invite button per token
- Stats display (total declarations, total tokens)

Commit: `git add src/components/monitor/DeclarationManager.tsx src/app/monitor/declarations/page.tsx && git commit -m "feat: build declarations page with extracted DeclarationManager component"`

---

## Task 5: Update Navigation Config

**Files:**
- Modify: `src/lib/navigation.ts`

Change all four Monitor items from `exists: false` to `exists: true`:

```typescript
items: [
  { label: "Drift & Alerts", href: "/monitor/drift", icon: "activity", exists: true },
  { label: "Escalations", href: "/monitor/escalations", icon: "alert-triangle", exists: true },
  { label: "Incidents", href: "/monitor/incidents", icon: "zap", exists: true },
  { label: "Declarations", href: "/monitor/declarations", icon: "user-check", exists: true },
],
```

Commit: `git add src/lib/navigation.ts && git commit -m "feat: mark all Monitor nav items as exists:true"`

---

## Task 6: Build Verification

Run `npx tsc --noEmit` and `npm run build` to verify everything compiles.

Commit any fixes if needed.

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Drift & Alerts page with table and filters | 1 page |
| 2 | Escalations page with resolve action | 1 page |
| 3 | Incidents page (reuses IncidentLog) | 1 page |
| 4 | Declarations page + DeclarationManager component | 1 page + 1 component |
| 5 | Update navigation config | 1 file |
| 6 | Build verification | — |
