# Verisum Control Centre Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current tab-based dashboard with a unified "Control Centre" — a command surface that lets CISOs/CTOs see and act on the full AI governance posture (Govern / Monitor / Prove) in one view.

**Architecture:** A single-page dashboard at `/dashboard` that parallel-fetches from ~8 existing API endpoints via a new aggregation route (`/api/dashboard/control-centre`). The page is built from composable section components (PostureStrip, IncidentsList, ScoreRing, etc.) arranged in a responsive grid. A new `compliance_frameworks` table tracks framework coverage percentages. Navigation renames "Dashboard" → "Control Centre" with count badges on sidebar items.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS 4, Recharts 3.6, Supabase (Postgres + RLS)

---

## Design Reference

The HTML mockup at `/Users/robfanshawe/Downloads/verisum-control-centre-v2.html` is the visual target. Key mapping decisions:

| Mockup Concept | Implementation |
|----------------|----------------|
| Topbar tier badges (Govern/Monitor/Prove) | Keep existing topbar; tier info is in PostureStrip instead |
| Live clock in topbar | Skip for MVP — low value, adds complexity |
| Sidebar reorganization | Update `navigation.ts` labels and add count badges |
| Posture Strip (3-column) | New `PostureStrip` component fetching aggregated metrics |
| Incidents & Escalations list | New `IncidentsList` component from existing APIs |
| Verisum Score ring (SVG) | New `ScoreRing` component from health API |
| Quick Actions grid | New `QuickActions` component with links to existing flows |
| Compliance Frameworks grid | New table + API + `ComplianceGrid` component |
| Drift Detection list | New `DriftList` component from existing drift API |
| Governance Events sparkline | New `EventSparkline` using Recharts BarChart from audit_log |
| Regulatory Feed | New `RegFeedCard` component from existing regulatory API |
| Recent Activity | New `ActivityFeed` component from existing recent-activity API |
| HAPP Proof Strip (dark banner) | New `HAPPStrip` component from attestation + provenance APIs |

**Color mapping:** The mockup uses `#673de6` (purple) as brand; the actual codebase uses `#0066FF` (blue) as `--brand`. Use the codebase's existing design tokens — `--brand`, `--coral`, `--teal`, `--tier-*` colors. Do NOT import the mockup's purple palette.

---

## Task 1: Migration — `compliance_frameworks` table

**Files:**
- Create: `supabase/migrations/027_compliance_frameworks.sql`

**Step 1: Write the migration**

```sql
-- 027_compliance_frameworks.sql
-- Tracks compliance framework coverage for the Control Centre dashboard

CREATE TABLE IF NOT EXISTS compliance_frameworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name text NOT NULL,                            -- e.g. "EU AI Act", "ISO 42001"
  short_name text,                               -- e.g. "EUAIA", "ISO42001"
  coverage_pct integer NOT NULL DEFAULT 0 CHECK (coverage_pct BETWEEN 0 AND 100),
  status text NOT NULL DEFAULT 'on_track' CHECK (status IN ('on_track', 'at_risk', 'overdue', 'completed')),
  due_date date,
  notes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique per org + name
CREATE UNIQUE INDEX idx_cf_org_name ON compliance_frameworks(organisation_id, name);
CREATE INDEX idx_cf_org_status ON compliance_frameworks(organisation_id, status);

-- Auto-update updated_at
CREATE TRIGGER set_cf_updated_at
  BEFORE UPDATE ON compliance_frameworks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE compliance_frameworks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org frameworks"
  ON compliance_frameworks FOR SELECT
  USING (organisation_id IN (
    SELECT organisation_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can manage own org frameworks"
  ON compliance_frameworks FOR ALL
  USING (organisation_id IN (
    SELECT organisation_id FROM profiles WHERE id = auth.uid()
  ));

-- Seed common frameworks for existing orgs (optional — they start empty, users add them)
```

**Step 2: Apply the migration**

Use Supabase MCP `apply_migration` tool with the SQL above.

**Step 3: Commit**

```bash
git add supabase/migrations/027_compliance_frameworks.sql
git commit -m "feat: add compliance_frameworks table for Control Centre"
```

---

## Task 2: API — Compliance Frameworks CRUD

**Files:**
- Create: `src/app/api/compliance-frameworks/route.ts`
- Modify: `src/lib/validations.ts` — add Zod schemas

**Step 1: Add Zod schemas to validations.ts**

Find the end of the existing schemas in `src/lib/validations.ts` and add:

```typescript
// ── Compliance Frameworks ──
export const createComplianceFrameworkSchema = z.object({
  name: z.string().min(1).max(200),
  short_name: z.string().max(20).optional(),
  coverage_pct: z.number().int().min(0).max(100).default(0),
  status: z.enum(["on_track", "at_risk", "overdue", "completed"]).default("on_track"),
  due_date: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export const updateComplianceFrameworkSchema = z.object({
  id: z.string().uuid(),
  coverage_pct: z.number().int().min(0).max(100).optional(),
  status: z.enum(["on_track", "at_risk", "overdue", "completed"]).optional(),
  due_date: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
```

**Step 2: Create the API route**

Create `src/app/api/compliance-frameworks/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createComplianceFrameworkSchema, updateComplianceFrameworkSchema, firstZodError } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const db = supabaseServer();
  const { data: profile } = await db.from("profiles").select("organisation_id").eq("id", user.id).single();
  if (!profile?.organisation_id) return NextResponse.json({ error: "No organisation linked" }, { status: 400 });

  const { data, error } = await db
    .from("compliance_frameworks")
    .select("*")
    .eq("organisation_id", profile.organisation_id)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ frameworks: data ?? [] });
}

export async function POST(req: NextRequest) {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const db = supabaseServer();
  const { data: profile } = await db.from("profiles").select("organisation_id").eq("id", user.id).single();
  if (!profile?.organisation_id) return NextResponse.json({ error: "No organisation linked" }, { status: 400 });

  const body = await req.json();
  const parsed = createComplianceFrameworkSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });

  const { data, error } = await db
    .from("compliance_frameworks")
    .insert({ ...parsed.data, organisation_id: profile.organisation_id, created_by: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const db = supabaseServer();
  const { data: profile } = await db.from("profiles").select("organisation_id").eq("id", user.id).single();
  if (!profile?.organisation_id) return NextResponse.json({ error: "No organisation linked" }, { status: 400 });

  const body = await req.json();
  const parsed = updateComplianceFrameworkSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });

  const { id, ...updates } = parsed.data;
  const { data, error } = await db
    .from("compliance_frameworks")
    .update(updates)
    .eq("id", id)
    .eq("organisation_id", profile.organisation_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

**Step 3: Verify build**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/lib/validations.ts src/app/api/compliance-frameworks/route.ts
git commit -m "feat: compliance frameworks CRUD API for Control Centre"
```

---

## Task 3: API — Control Centre Aggregation Endpoint

**Files:**
- Create: `src/app/api/dashboard/control-centre/route.ts`

This endpoint parallel-fetches from existing tables to return all data the Control Centre needs in a single request. This avoids the UI making 8+ separate API calls.

**Step 1: Create the aggregation route**

Create `src/app/api/dashboard/control-centre/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const db = supabaseServer();
  const { data: profile } = await db
    .from("profiles")
    .select("organisation_id, plan, display_name")
    .eq("id", user.id)
    .single();

  if (!profile?.organisation_id) {
    return NextResponse.json({ error: "No organisation linked" }, { status: 400 });
  }

  const orgId = profile.organisation_id;

  // Parallel fetch all data sources
  const [
    healthRes,
    escalationsRes,
    incidentsRes,
    driftRes,
    regulatoryRes,
    activityRes,
    frameworksRes,
    actionsRes,
    attestationsRes,
    provenanceRes,
  ] = await Promise.allSettled([
    // 1. Health score
    db.rpc("tg_compute_health", { p_org: orgId }).single(),

    // 2. Top escalations (unresolved, by severity)
    db.from("escalations")
      .select("id, reason, severity, status, trigger_type, assigned_to, created_at, source_signal:runtime_signals(id, system_name, metric_name)")
      .eq("organisation_id", orgId)
      .eq("resolved", false)
      .order("created_at", { ascending: false })
      .limit(6),

    // 3. Open incidents
    db.from("incidents")
      .select("id, title, status, impact_level, system_id, created_at, ai_vendors(vendor_name)")
      .eq("organisation_id", orgId)
      .neq("status", "closed")
      .order("created_at", { ascending: false })
      .limit(6),

    // 4. Drift summary
    db.from("drift_events")
      .select("id, run_type, delta_score, drift_flag, created_at")
      .eq("organisation_id", orgId)
      .eq("drift_flag", true)
      .order("created_at", { ascending: false })
      .limit(10),

    // 5. Regulatory feed (latest 4)
    db.from("regulatory_updates")
      .select("id, title, summary, jurisdictions, published_at")
      .order("published_at", { ascending: false })
      .limit(4),

    // 6. Recent activity (latest 6 audit entries)
    db.from("audit_log")
      .select("id, entity_type, action_type, performed_by, metadata, created_at")
      .eq("organisation_id", orgId)
      .order("created_at", { ascending: false })
      .limit(6),

    // 7. Compliance frameworks
    db.from("compliance_frameworks")
      .select("*")
      .eq("organisation_id", orgId)
      .order("name"),

    // 8. Actions summary (open count, overdue count)
    db.from("actions")
      .select("id, status, severity, due_date")
      .eq("organisation_id", orgId)
      .eq("status", "open"),

    // 9. Attestations count (Prove tier)
    db.from("prove_attestations")
      .select("id, is_valid, chain_status")
      .eq("organisation_id", orgId)
      .eq("is_valid", true),

    // 10. Provenance count (Prove tier)
    db.from("prove_provenance")
      .select("id, chain_status")
      .eq("organisation_id", orgId),
  ]);

  // Extract results safely
  const safe = <T>(res: PromiseSettledResult<{ data: T | null; error: unknown }>) =>
    res.status === "fulfilled" && !res.error ? res.value.data : null;

  const health = healthRes.status === "fulfilled" ? healthRes.value.data : null;
  const escalations = safe(escalationsRes) ?? [];
  const incidents = safe(incidentsRes) ?? [];
  const driftEvents = safe(driftRes) ?? [];
  const regulatory = safe(regulatoryRes) ?? [];
  const activity = safe(activityRes) ?? [];
  const frameworks = safe(frameworksRes) ?? [];
  const openActions = safe(actionsRes) ?? [];
  const attestations = safe(attestationsRes) ?? [];
  const provenance = safe(provenanceRes) ?? [];

  // Compute posture metrics
  const now = new Date();
  const overdueActions = openActions.filter(
    (a: { due_date?: string }) => a.due_date && new Date(a.due_date) < now
  );

  return NextResponse.json({
    plan: profile.plan,
    govern: {
      health_score: health?.health_score ?? null,
      org_base: health?.org_base ?? null,
      sys_base: health?.sys_base ?? null,
      open_actions: openActions.length,
      overdue_actions: overdueActions.length,
    },
    monitor: {
      escalations,
      escalation_count: escalations.length,
      incidents,
      incident_count: incidents.length,
      drift_events: driftEvents,
      drift_count: driftEvents.length,
    },
    prove: {
      attestation_count: attestations.length,
      provenance_count: provenance.length,
    },
    frameworks,
    regulatory,
    activity,
  });
}
```

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add "src/app/api/dashboard/control-centre/route.ts"
git commit -m "feat: control centre aggregation API endpoint"
```

---

## Task 4: UI — PostureStrip Component

**Files:**
- Create: `src/components/control-centre/PostureStrip.tsx`

This is the 3-column Govern | Monitor | Prove metrics bar at the top of the Control Centre.

**Step 1: Create the component**

Create `src/components/control-centre/PostureStrip.tsx`:

```typescript
"use client";

type PostureData = {
  govern: {
    health_score: number | null;
    open_actions: number;
    overdue_actions: number;
  };
  monitor: {
    escalation_count: number;
    drift_count: number;
    incident_count: number;
  };
  prove: {
    attestation_count: number;
    provenance_count: number;
  };
};

export default function PostureStrip({ data }: { data: PostureData }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      {/* GOVERN */}
      <div className="p-4 border-b md:border-b-0 md:border-r border-border relative cursor-pointer hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
          <span className="w-4 h-4 rounded bg-brand/10 flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1L9 3V6C9 8 7.5 9.5 5 10C2.5 9.5 1 8 1 6V3L5 1Z" stroke="var(--brand)" strokeWidth="1.2" fill="none"/></svg>
          </span>
          Govern
        </div>
        <div className="flex gap-5">
          <Metric value={data.govern.health_score ?? "—"} label="Verisum Score" color="text-brand" />
          <Metric value={data.govern.open_actions} label="Open actions" color="text-foreground" />
          <Metric value={data.govern.overdue_actions} label="Overdue" color={data.govern.overdue_actions > 0 ? "text-[var(--warning)]" : "text-foreground"} />
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand" />
      </div>

      {/* MONITOR */}
      <div className="p-4 border-b md:border-b-0 md:border-r border-border relative cursor-pointer hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
          <span className="w-4 h-4 rounded bg-coral/10 flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 6.5L3 5L5 6.5L7 3L9 4.5" stroke="var(--coral)" strokeWidth="1.2" strokeLinecap="round"/></svg>
          </span>
          Monitor
        </div>
        <div className="flex gap-5">
          <Metric value={data.monitor.escalation_count} label="Escalations" color={data.monitor.escalation_count > 0 ? "text-[var(--destructive)]" : "text-foreground"} />
          <Metric value={data.monitor.drift_count} label="Drift alerts" color={data.monitor.drift_count > 0 ? "text-coral" : "text-foreground"} />
          <Metric value={data.monitor.incident_count} label="Open incidents" color="text-foreground" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-coral" />
      </div>

      {/* PROVE */}
      <div className="p-4 relative cursor-pointer hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
          <span className="w-4 h-4 rounded bg-teal/10 flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2.5 5L4.5 7L7.5 3" stroke="var(--teal)" strokeWidth="1.2" strokeLinecap="round"/></svg>
          </span>
          Prove
        </div>
        <div className="flex gap-5">
          <Metric value={data.prove.attestation_count} label="Attestations" color="text-teal" />
          <Metric value={data.prove.provenance_count} label="Proofs issued" color="text-foreground" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal" />
      </div>
    </div>
  );
}

function Metric({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <div className="flex-1">
      <div className={`font-mono text-xl font-medium leading-none tracking-tight ${color}`}>
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground mt-1 whitespace-nowrap">{label}</div>
    </div>
  );
}
```

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/components/control-centre/PostureStrip.tsx
git commit -m "feat: PostureStrip component for Control Centre"
```

---

## Task 5: UI — ScoreRing, IncidentsList, QuickActions (Row 1)

**Files:**
- Create: `src/components/control-centre/ScoreRing.tsx`
- Create: `src/components/control-centre/IncidentsList.tsx`
- Create: `src/components/control-centre/QuickActions.tsx`

### Step 1: Create ScoreRing

Create `src/components/control-centre/ScoreRing.tsx`:

```typescript
"use client";

const CIRCUMFERENCE = 2 * Math.PI * 38; // r=38 matching mockup

type ScoreRingProps = {
  score: number | null;
  dimensions?: { label: string; value: number }[];
};

export default function ScoreRing({ score, dimensions }: ScoreRingProps) {
  const s = score ?? 0;
  const offset = CIRCUMFERENCE - (s / 100) * CIRCUMFERENCE;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <div className="text-[13px] font-semibold">Verisum Score</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">TrustOrg composite</div>
        </div>
      </div>
      <div className="p-4 flex items-center gap-5">
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg className="-rotate-90" width="96" height="96" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r="38" fill="none" stroke="var(--border)" strokeWidth="7" />
            <circle
              cx="48" cy="48" r="38"
              fill="none"
              stroke="var(--brand)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-xl font-medium text-brand leading-none">
              {score ?? "—"}
            </span>
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">/ 100</span>
          </div>
        </div>
        {dimensions && dimensions.length > 0 && (
          <div className="flex-1 flex flex-col gap-1.5">
            {dimensions.map((d) => (
              <div key={d.label} className="flex items-center gap-2">
                <span className="w-20 text-[11.5px] text-muted-foreground flex-shrink-0">{d.label}</span>
                <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${d.value}%`,
                      background: d.value >= 70 ? "var(--brand)" : d.value >= 50 ? "var(--warning)" : "var(--destructive)",
                    }}
                  />
                </div>
                <span className="font-mono text-[11px] text-muted-foreground w-6 text-right flex-shrink-0">{d.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

### Step 2: Create IncidentsList

Create `src/components/control-centre/IncidentsList.tsx`:

```typescript
"use client";

import Link from "next/link";

type Escalation = {
  id: string;
  reason: string;
  severity: string;
  status: string;
  created_at: string;
  assigned_to?: string;
};

type Incident = {
  id: string;
  title: string;
  status: string;
  impact_level: string;
  created_at: string;
};

type Props = {
  escalations: Escalation[];
  incidents: Incident[];
};

const SEV_COLORS: Record<string, string> = {
  critical: "bg-[var(--destructive)] shadow-[0_0_0_2px_rgba(212,24,61,0.18)]",
  high: "bg-[var(--warning)] shadow-[0_0_0_2px_rgba(255,140,0,0.18)]",
  medium: "bg-brand shadow-[0_0_0_2px_rgba(0,102,255,0.12)]",
  low: "bg-muted-foreground/40",
};

const SEV_TAG: Record<string, string> = {
  critical: "bg-[var(--destructive)]/10 text-[var(--destructive)]",
  high: "bg-[var(--warning)]/10 text-[var(--warning)]",
  medium: "bg-brand/10 text-brand",
  low: "bg-muted text-muted-foreground border border-border",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function IncidentsList({ escalations, incidents }: Props) {
  // Merge and sort by created_at descending
  const items = [
    ...escalations.map((e) => ({
      id: e.id,
      title: e.reason,
      severity: e.severity,
      type: "escalation" as const,
      created_at: e.created_at,
      meta: e.assigned_to ? `Assigned: ${e.assigned_to}` : "Unassigned",
    })),
    ...incidents.map((i) => ({
      id: i.id,
      title: i.title,
      severity: i.impact_level,
      type: "incident" as const,
      created_at: i.created_at,
      meta: i.status,
    })),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6);

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <div className="text-[13px] font-semibold">Active Escalations & Incidents</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Sorted by severity · {items.length} showing
          </div>
        </div>
        <Link href="/monitor/incidents" className="text-[11.5px] text-brand font-medium hover:opacity-70 transition-opacity">
          View all →
        </Link>
      </div>
      <div className="flex flex-col">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors"
          >
            <div className={`w-[7px] h-[7px] rounded-full flex-shrink-0 ${SEV_COLORS[item.severity] ?? SEV_COLORS.low}`} />
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-medium text-foreground truncate">{item.title}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{item.meta}</div>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className={`text-[10.5px] font-medium px-2 py-0.5 rounded ${SEV_TAG[item.severity] ?? SEV_TAG.low}`}>
                {item.severity.charAt(0).toUpperCase() + item.severity.slice(1)}
              </span>
              <span className="font-mono text-[10.5px] text-muted-foreground">{timeAgo(item.created_at)}</span>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">No active escalations or incidents</div>
        )}
      </div>
    </div>
  );
}
```

### Step 3: Create QuickActions

Create `src/components/control-centre/QuickActions.tsx`:

```typescript
"use client";

import Link from "next/link";

const ACTIONS = [
  {
    label: "Escalate Incident",
    href: "/monitor/escalations",
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <path d="M6.5 2V7.5M6.5 9V10" stroke="var(--destructive)" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="6.5" cy="6.5" r="5.5" stroke="var(--destructive)" strokeWidth="1.3" />
      </svg>
    ),
    bg: "bg-[var(--destructive)]/10",
  },
  {
    label: "New Assessment",
    href: "/trustsys",
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <path d="M6.5 2V11M2 6.5H11" stroke="var(--brand)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    bg: "bg-brand/10",
  },
  {
    label: "Run Policy Check",
    href: "/copilot/generate-policy",
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <path d="M2 3H11M3.5 1.5H9.5M4 11.5L5.5 3M7.5 3L9 11.5" stroke="var(--warning)" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
    bg: "bg-[var(--warning)]/10",
  },
  {
    label: "Issue Attestation",
    href: "/prove/attestations",
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <path d="M3 6.5L5.5 9L10 4" stroke="var(--teal)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    bg: "bg-teal/10",
  },
  {
    label: "Check Drift Score",
    href: "/monitor/drift",
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <path d="M2 8L5 5.5L7.5 7.5L11 3" stroke="var(--coral)" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
    bg: "bg-coral/10",
  },
  {
    label: "Board Report Pack",
    href: "/reports",
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <rect x="2" y="2.5" width="9" height="8" rx="1.5" stroke="var(--muted-foreground)" strokeWidth="1.3" />
        <path d="M4.5 5H8.5M4.5 7.5H6.5" stroke="var(--muted-foreground)" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
    bg: "bg-muted border border-border",
  },
];

export default function QuickActions() {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <div className="text-[13px] font-semibold">Quick Actions</div>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3">
        {ACTIONS.map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className="flex items-center gap-2 px-3 py-2.5 rounded-md border border-border bg-muted/30 hover:border-brand hover:bg-brand/5 transition-all text-left"
          >
            <span className={`w-[26px] h-[26px] rounded-md flex items-center justify-center flex-shrink-0 ${a.bg}`}>
              {a.icon}
            </span>
            <span className="text-[11.5px] font-medium text-foreground leading-tight">{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

**Step 4: Verify build**

```bash
npm run build
```

**Step 5: Commit**

```bash
git add src/components/control-centre/ScoreRing.tsx src/components/control-centre/IncidentsList.tsx src/components/control-centre/QuickActions.tsx
git commit -m "feat: ScoreRing, IncidentsList, QuickActions components for Control Centre"
```

---

## Task 6: UI — ComplianceGrid, DriftList, RegFeedCard, ActivityFeed (Row 2)

**Files:**
- Create: `src/components/control-centre/ComplianceGrid.tsx`
- Create: `src/components/control-centre/DriftList.tsx`
- Create: `src/components/control-centre/RegFeedCard.tsx`
- Create: `src/components/control-centre/ActivityFeed.tsx`

### Step 1: Create ComplianceGrid

Create `src/components/control-centre/ComplianceGrid.tsx`:

```typescript
"use client";

import Link from "next/link";

type Framework = {
  id: string;
  name: string;
  coverage_pct: number;
  status: string;
  due_date: string | null;
};

function pctColor(pct: number): string {
  if (pct >= 85) return "var(--success)";
  if (pct >= 70) return "var(--warning)";
  return "var(--destructive)";
}

function statusLabel(status: string, due: string | null): { text: string; className: string } {
  if (status === "overdue") return { text: "Overdue", className: "text-[var(--destructive)]" };
  if (status === "at_risk") return { text: "At risk", className: "text-[var(--warning)]" };
  if (due) {
    const d = new Date(due);
    const diff = Math.ceil((d.getTime() - Date.now()) / 86400000);
    if (diff < 0) return { text: "Overdue", className: "text-[var(--destructive)]" };
    if (diff <= 14) return { text: `Due ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`, className: "text-coral" };
    return { text: `Due ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`, className: "text-muted-foreground" };
  }
  return { text: "Ongoing", className: "text-muted-foreground" };
}

export default function ComplianceGrid({ frameworks }: { frameworks: Framework[] }) {
  if (frameworks.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <div className="text-[13px] font-semibold">Compliance Frameworks</div>
        </div>
        <div className="p-8 text-center text-sm text-muted-foreground">
          No frameworks configured yet.
          <Link href="/dashboard/settings" className="text-brand ml-1 hover:underline">Add one</Link>
        </div>
      </div>
    );
  }

  const onTrack = frameworks.filter((f) => f.status === "on_track" || f.status === "completed").length;
  const atRisk = frameworks.filter((f) => f.status === "at_risk").length;
  const overdue = frameworks.filter((f) => f.status === "overdue").length;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <div className="text-[13px] font-semibold">Compliance Frameworks</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{frameworks.length} active</div>
        </div>
        <Link href="/compliance" className="text-[11.5px] text-brand font-medium hover:opacity-70 transition-opacity">
          Manage
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-px bg-border">
        {frameworks.slice(0, 6).map((f) => {
          const color = pctColor(f.coverage_pct);
          const due = statusLabel(f.status, f.due_date);
          return (
            <div key={f.id} className="bg-card p-3 hover:bg-muted/30 cursor-pointer transition-colors">
              <div className="text-[12px] font-semibold text-foreground mb-1.5">{f.name}</div>
              <div className="h-1 bg-border rounded-full overflow-hidden mb-1.5">
                <div className="h-full rounded-full" style={{ width: `${f.coverage_pct}%`, background: color }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[12.5px] font-medium" style={{ color }}>{f.coverage_pct}%</span>
                <span className={`text-[10.5px] ${due.className}`}>{due.text}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-px bg-border border-t border-border">
        <div className="bg-card p-2.5 text-center">
          <div className="font-mono text-[17px] font-medium text-[var(--success)]">{onTrack}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">On Track</div>
        </div>
        <div className="bg-card p-2.5 text-center">
          <div className="font-mono text-[17px] font-medium text-[var(--warning)]">{atRisk}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">At Risk</div>
        </div>
        <div className="bg-card p-2.5 text-center">
          <div className="font-mono text-[17px] font-medium text-[var(--destructive)]">{overdue}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Overdue</div>
        </div>
      </div>
    </div>
  );
}
```

### Step 2: Create DriftList

Create `src/components/control-centre/DriftList.tsx`:

```typescript
"use client";

import Link from "next/link";

type DriftEvent = {
  id: string;
  run_type: string;
  delta_score: number;
  created_at: string;
};

export default function DriftList({ events }: { events: DriftEvent[] }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <div className="text-[13px] font-semibold">Drift Detection</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{events.length} alerts active</div>
        </div>
        <Link href="/monitor/drift" className="text-[11.5px] text-brand font-medium hover:opacity-70 transition-opacity">
          View all
        </Link>
      </div>
      <div className="flex flex-col">
        {events.slice(0, 4).map((ev) => {
          const abs = Math.abs(ev.delta_score);
          const isCritical = abs >= 10;
          const isWarn = abs >= 5 && abs < 10;
          return (
            <div
              key={ev.id}
              className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors"
            >
              <div
                className={`w-[26px] h-[26px] rounded flex items-center justify-center flex-shrink-0 ${
                  isCritical ? "bg-[var(--destructive)]/10" : isWarn ? "bg-[var(--warning)]/10" : "bg-brand/10"
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M1 7.5L3.5 5L5.5 7L8.5 3L11 5"
                    stroke={isCritical ? "var(--destructive)" : isWarn ? "var(--warning)" : "var(--brand)"}
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-[12.5px] font-medium text-foreground">
                  {ev.run_type === "sys" ? "System" : "Org"} Assessment
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Score: {ev.delta_score > 0 ? "+" : ""}{ev.delta_score} pts
                </div>
              </div>
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  isCritical
                    ? "bg-[var(--destructive)]/10 text-[var(--destructive)]"
                    : isWarn
                      ? "bg-[var(--warning)]/10 text-[var(--warning)]"
                      : "bg-brand/10 text-brand"
                }`}
              >
                <span className="w-[5px] h-[5px] rounded-full bg-current" />
                {isCritical ? "Critical" : isWarn ? "Warning" : "Drifting"}
              </span>
            </div>
          );
        })}
        {events.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">No drift alerts</div>
        )}
      </div>
    </div>
  );
}
```

### Step 3: Create RegFeedCard

Create `src/components/control-centre/RegFeedCard.tsx`:

```typescript
"use client";

import Link from "next/link";

type RegUpdate = {
  id: string;
  title: string;
  jurisdictions: string[];
  published_at: string;
};

const FLAG_STYLE: Record<string, string> = {
  eu: "bg-green-50 text-green-900",
  uk: "bg-blue-50 text-blue-900",
};

export default function RegFeedCard({ updates }: { updates: RegUpdate[] }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <div className="text-[13px] font-semibold">Regulatory Feed</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{updates.length} updates</div>
        </div>
        <Link href="/copilot/generate-policy" className="text-[11.5px] text-brand font-medium hover:opacity-70 transition-opacity">
          All updates
        </Link>
      </div>
      <div className="flex flex-col">
        {updates.slice(0, 3).map((u) => {
          const jur = u.jurisdictions?.[0]?.toLowerCase() ?? "eu";
          return (
            <div key={u.id} className="flex gap-2.5 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors">
              <span className={`w-7 h-5 rounded text-[8px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5 ${FLAG_STYLE[jur] ?? FLAG_STYLE.eu}`}>
                {jur.toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium text-foreground leading-snug">{u.title}</div>
                <div className="text-[10.5px] text-muted-foreground font-mono mt-0.5">
                  {new Date(u.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </div>
              </div>
            </div>
          );
        })}
        {updates.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">No regulatory updates</div>
        )}
      </div>
    </div>
  );
}
```

### Step 4: Create ActivityFeed

Create `src/components/control-centre/ActivityFeed.tsx`:

```typescript
"use client";

import Link from "next/link";

type ActivityItem = {
  id: string;
  entity_type: string;
  action_type: string;
  performed_by: string;
  metadata?: Record<string, unknown>;
  created_at: string;
};

function formatAction(item: ActivityItem): string {
  const entity = item.entity_type?.replace(/_/g, " ") ?? "item";
  const action = item.action_type ?? "updated";
  const meta = item.metadata as Record<string, string> | undefined;
  const title = meta?.title ?? meta?.reason ?? entity;
  return `${action.charAt(0).toUpperCase() + action.slice(1)} ${entity}: ${title}`;
}

function timeLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) + " · Today";
  }
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + " · " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex-1">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="text-[13px] font-semibold">Recent Activity</div>
        <Link href="/actions" className="text-[11.5px] text-brand font-medium hover:opacity-70 transition-opacity">
          All activity
        </Link>
      </div>
      <div className="flex flex-col">
        {items.slice(0, 5).map((item) => (
          <div key={item.id} className="flex gap-2.5 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors">
            <div className="w-6 h-6 rounded bg-muted border border-border flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M1.5 3H9.5M1.5 5.5H7M1.5 8H5" stroke="var(--brand)" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-[12px] text-foreground leading-snug">{formatAction(item)}</div>
              <div className="text-[10.5px] text-muted-foreground font-mono mt-0.5">{timeLabel(item.created_at)}</div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">No recent activity</div>
        )}
      </div>
    </div>
  );
}
```

**Step 5: Verify build**

```bash
npm run build
```

**Step 6: Commit**

```bash
git add src/components/control-centre/ComplianceGrid.tsx src/components/control-centre/DriftList.tsx src/components/control-centre/RegFeedCard.tsx src/components/control-centre/ActivityFeed.tsx
git commit -m "feat: ComplianceGrid, DriftList, RegFeedCard, ActivityFeed for Control Centre"
```

---

## Task 7: UI — HAPPStrip Component

**Files:**
- Create: `src/components/control-centre/HAPPStrip.tsx`

The dark navy banner at the bottom showing HAPP protocol proof status.

**Step 1: Create the component**

Create `src/components/control-centre/HAPPStrip.tsx`:

```typescript
"use client";

import Link from "next/link";

type HAPPStripProps = {
  proofCount: number;
  attestationCount: number;
  plan: string;
};

export default function HAPPStrip({ proofCount, attestationCount, plan }: HAPPStripProps) {
  const isVerify = plan === "enterprise";

  if (!isVerify) {
    return (
      <div className="rounded-xl bg-foreground/95 p-4 flex items-center gap-4 border border-brand/20">
        <div className="w-[38px] h-[38px] rounded bg-brand flex items-center justify-center flex-shrink-0">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2L15 5.5V10C15 13.5 12.5 16.5 9 17C5.5 16.5 3 13.5 3 10V5.5L9 2Z" stroke="white" strokeWidth="1.4" fill="none"/>
            <path d="M5.5 9.5L8 12L12.5 6.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="flex-1">
          <div className="text-[13px] font-semibold text-white">HAPP Protocol</div>
          <div className="text-[11.5px] text-white/50 mt-0.5">
            Tamper-proof governance attestations. Available on the Verify tier.
          </div>
        </div>
        <Link
          href="/upgrade"
          className="px-3 py-1.5 rounded text-[12px] font-medium bg-brand text-white hover:bg-brand-hover transition-colors"
        >
          Upgrade
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-foreground/95 p-4 flex items-center gap-4 border border-brand/30">
      <div className="w-[38px] h-[38px] rounded bg-brand flex items-center justify-center flex-shrink-0">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M9 2L15 5.5V10C15 13.5 12.5 16.5 9 17C5.5 16.5 3 13.5 3 10V5.5L9 2Z" stroke="white" strokeWidth="1.4" fill="none"/>
          <path d="M5.5 9.5L8 12L12.5 6.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <div className="flex-1">
        <div className="text-[13px] font-semibold text-white">HAPP Protocol · Governance Proof Ready</div>
        <div className="text-[11.5px] text-white/50 mt-0.5">
          Tamper-proof attestation anchored on-chain · {proofCount} proofs issued · {attestationCount} active attestations
        </div>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <Link
          href="/prove/verification"
          className="flex items-center gap-1 px-3 py-1.5 rounded text-[12px] font-medium text-white/70 bg-white/5 border border-white/15 hover:bg-white/10 transition-colors"
        >
          Verify Proof
        </Link>
        <Link
          href="/reports"
          className="flex items-center gap-1 px-3 py-1.5 rounded text-[12px] font-medium text-white bg-brand border border-brand hover:bg-brand-hover transition-colors"
        >
          Board Pack
        </Link>
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/components/control-centre/HAPPStrip.tsx
git commit -m "feat: HAPPStrip component for Control Centre"
```

---

## Task 8: UI — Control Centre Page (Wire Everything Together)

**Files:**
- Modify: `src/app/dashboard/page.tsx` — replace entire content

This is the main page rewrite. The old 1229-line tab-based dashboard is replaced with the Control Centre layout.

**Step 1: Rewrite the dashboard page**

Replace the entire contents of `src/app/dashboard/page.tsx` with:

```typescript
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import AuthenticatedShell from "@/components/AuthenticatedShell";
import RequireAuth from "@/components/RequireAuth";
import PostureStrip from "@/components/control-centre/PostureStrip";
import IncidentsList from "@/components/control-centre/IncidentsList";
import ScoreRing from "@/components/control-centre/ScoreRing";
import QuickActions from "@/components/control-centre/QuickActions";
import ComplianceGrid from "@/components/control-centre/ComplianceGrid";
import DriftList from "@/components/control-centre/DriftList";
import RegFeedCard from "@/components/control-centre/RegFeedCard";
import ActivityFeed from "@/components/control-centre/ActivityFeed";
import HAPPStrip from "@/components/control-centre/HAPPStrip";

// ---------------------------------------------------------------------------
// Types (matches /api/dashboard/control-centre response)
// ---------------------------------------------------------------------------

type ControlCentreData = {
  plan: string;
  govern: {
    health_score: number | null;
    org_base: number | null;
    sys_base: number | null;
    open_actions: number;
    overdue_actions: number;
  };
  monitor: {
    escalations: Array<{
      id: string;
      reason: string;
      severity: string;
      status: string;
      created_at: string;
      assigned_to?: string;
    }>;
    escalation_count: number;
    incidents: Array<{
      id: string;
      title: string;
      status: string;
      impact_level: string;
      created_at: string;
    }>;
    incident_count: number;
    drift_events: Array<{
      id: string;
      run_type: string;
      delta_score: number;
      created_at: string;
    }>;
    drift_count: number;
  };
  prove: {
    attestation_count: number;
    provenance_count: number;
  };
  frameworks: Array<{
    id: string;
    name: string;
    coverage_pct: number;
    status: string;
    due_date: string | null;
  }>;
  regulatory: Array<{
    id: string;
    title: string;
    jurisdictions: string[];
    published_at: string;
  }>;
  activity: Array<{
    id: string;
    entity_type: string;
    action_type: string;
    performed_by: string;
    metadata?: Record<string, unknown>;
    created_at: string;
  }>;
};

// ---------------------------------------------------------------------------
// Root page
// ---------------------------------------------------------------------------

export default function DashboardHome() {
  return (
    <RequireAuth>
      <ControlCentre />
    </RequireAuth>
  );
}

// ---------------------------------------------------------------------------
// Control Centre
// ---------------------------------------------------------------------------

function ControlCentre() {
  const { user } = useAuth();
  const [data, setData] = useState<ControlCentreData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/dashboard/control-centre");
        if (!res.ok) throw new Error("Failed to load");
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        // Silently fail — components handle empty state
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <AuthenticatedShell>
      <div className="flex flex-col gap-[18px]">
        {/* Page Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">
              Control Centre
            </h1>
            <p className="text-[12.5px] text-muted-foreground mt-1">
              AI Governance Command Surface · {today}
            </p>
          </div>
          <div className="flex items-center gap-2 pt-1 flex-shrink-0">
            <a
              href="/reports"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[12.5px] font-medium border border-border bg-card hover:bg-muted/50 transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M5.5 1V7M3 5L5.5 7.5L8 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <path d="M1.5 9H9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              Export Briefing
            </a>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-brand border-t-transparent" />
          </div>
        )}

        {data && (
          <>
            {/* Posture Strip */}
            <PostureStrip data={{ govern: data.govern, monitor: data.monitor, prove: data.prove }} />

            {/* Row 1: Incidents (65%) + Score & Quick Actions (35%) */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.85fr_1fr] gap-4">
              <IncidentsList
                escalations={data.monitor.escalations}
                incidents={data.monitor.incidents}
              />
              <div className="flex flex-col gap-4">
                <ScoreRing score={data.govern.health_score} />
                <QuickActions />
              </div>
            </div>

            {/* Section Divider */}
            <div className="flex items-center gap-2.5">
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                Governance Detail
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Row 2: Compliance (2fr) + Drift + Reg/Activity (1fr each) */}
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr] gap-4">
              <ComplianceGrid frameworks={data.frameworks} />
              <div className="flex flex-col gap-4">
                <DriftList events={data.monitor.drift_events} />
              </div>
              <div className="flex flex-col gap-4">
                <RegFeedCard updates={data.regulatory} />
                <ActivityFeed items={data.activity} />
              </div>
            </div>

            {/* HAPP Proof Strip */}
            <HAPPStrip
              proofCount={data.prove.provenance_count}
              attestationCount={data.prove.attestation_count}
              plan={data.plan}
            />
          </>
        )}
      </div>
    </AuthenticatedShell>
  );
}
```

**Step 2: Verify build**

```bash
npm run build
```

Expected: Clean build with no errors.

**Step 3: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: replace dashboard with Control Centre page"
```

---

## Task 9: Navigation Updates

**Files:**
- Modify: `src/lib/navigation.ts` — rename Dashboard to Control Centre
- Modify: `src/components/AuthenticatedShell.tsx` — update icon for Control Centre

### Step 1: Update navigation.ts

In `src/lib/navigation.ts`, change the overview section:

```typescript
// Before:
{ label: "Dashboard", href: "/dashboard", icon: "home", exists: true },

// After:
{ label: "Control Centre", href: "/dashboard", icon: "layout-dashboard", exists: true },
```

### Step 2: Update AuthenticatedShell.tsx

In `src/components/AuthenticatedShell.tsx`, find where the `home` icon is mapped and add a mapping for `layout-dashboard`. If the icon system uses Lucide icons or a custom map, add:

```typescript
// In the icon rendering logic, add:
case "layout-dashboard":
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="9" y="2" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="2" y="9" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="9" y="9" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  );
```

If the icon system uses Lucide React, instead use `import { LayoutDashboard } from "lucide-react"` and map `"layout-dashboard"` → `LayoutDashboard`.

### Step 3: Verify build

```bash
npm run build
```

### Step 4: Commit

```bash
git add src/lib/navigation.ts src/components/AuthenticatedShell.tsx
git commit -m "feat: rename Dashboard → Control Centre in navigation"
```

---

## Task 10: Build Verification & Polish

**Step 1: Full build check**

```bash
npm run build
```

Must pass with zero errors.

**Step 2: Dev server visual check**

```bash
npm run dev
```

Navigate to `http://127.0.0.1:3000/dashboard` and verify:
- [ ] PostureStrip renders 3 columns (Govern / Monitor / Prove) with metrics
- [ ] Incidents list shows merged escalations + incidents sorted by time
- [ ] Score ring shows health score with SVG arc
- [ ] Quick Actions has 6 buttons in 2-column grid
- [ ] Compliance Frameworks shows grid (or empty state if no frameworks)
- [ ] Drift Detection shows drift events
- [ ] Regulatory Feed shows latest updates
- [ ] Activity Feed shows recent audit entries
- [ ] HAPP Strip renders at bottom (locked state for non-enterprise, or proof count for enterprise)
- [ ] Sidebar shows "Control Centre" instead of "Dashboard"
- [ ] Responsive: grid collapses to single column on mobile

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: Control Centre polish and build fixes"
```

---

## Files Summary

| File | Action |
|------|--------|
| `supabase/migrations/027_compliance_frameworks.sql` | **Create** |
| `src/lib/validations.ts` | Edit — add 2 compliance Zod schemas |
| `src/app/api/compliance-frameworks/route.ts` | **Create** |
| `src/app/api/dashboard/control-centre/route.ts` | **Create** |
| `src/components/control-centre/PostureStrip.tsx` | **Create** |
| `src/components/control-centre/ScoreRing.tsx` | **Create** |
| `src/components/control-centre/IncidentsList.tsx` | **Create** |
| `src/components/control-centre/QuickActions.tsx` | **Create** |
| `src/components/control-centre/ComplianceGrid.tsx` | **Create** |
| `src/components/control-centre/DriftList.tsx` | **Create** |
| `src/components/control-centre/RegFeedCard.tsx` | **Create** |
| `src/components/control-centre/ActivityFeed.tsx` | **Create** |
| `src/components/control-centre/HAPPStrip.tsx` | **Create** |
| `src/app/dashboard/page.tsx` | **Rewrite** — 1229 lines → ~180 lines |
| `src/lib/navigation.ts` | Edit — rename Dashboard → Control Centre |
| `src/components/AuthenticatedShell.tsx` | Edit — add layout-dashboard icon |

## Reusable Utilities

- `createSupabaseServerClient()` from `src/lib/supabase-auth-server.ts` — auth in API routes
- `supabaseServer()` from `src/lib/supabaseServer.ts` — service role DB access
- `firstZodError()` from `src/lib/validations.ts` — Zod error formatting
- `RequireAuth` from `src/components/RequireAuth.tsx` — page-level auth gate
- `AuthenticatedShell` from `src/components/AuthenticatedShell.tsx` — sidebar layout
- Existing CSS variables: `--brand`, `--coral`, `--teal`, `--success`, `--warning`, `--destructive`

## What This Does NOT Change

- The existing TrustOrg, TrustSys, and Copilot pages remain at their current routes (accessible via sidebar)
- No topbar changes (the mockup's topbar redesign with tier badges/live clock is deferred)
- No sidebar count badges on individual items (deferred — would require WebSocket or polling)
- The old dashboard's TrustTrends chart and CopilotDashboard are accessible from their own pages
