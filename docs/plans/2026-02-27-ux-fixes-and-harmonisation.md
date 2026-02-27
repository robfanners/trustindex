# UX Fixes and Results Harmonisation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix broken UX patterns (account settings, org page messaging, note saving, due dates, reports access), add generic ticket integration to actions, and harmonise Org Survey / System Assessment results pages.

**Architecture:** Incremental fixes to existing pages and API routes. One new migration for schema additions. New Jira integration scaffolded following the HiBob pattern. Results page harmonisation copies proven UI patterns between the two results views.

**Tech Stack:** Next.js 16.1 App Router, React 19, TypeScript 5, Supabase (Postgres + RLS), Tailwind CSS 4

---

### Task 1: Schema Migration — Actions Columns + action_updates Table Verification

**Files:**
- Create: `supabase/migrations/012_actions_and_reports_fixes.sql`

**Step 1: Write the migration**

```sql
-- 012_actions_and_reports_fixes.sql
-- Adds ticket integration columns to actions, source_type for filtering,
-- and ensures action_updates table exists with correct schema.

-- 1. Add ticket integration columns to actions
ALTER TABLE actions ADD COLUMN IF NOT EXISTS ticket_provider TEXT;
ALTER TABLE actions ADD COLUMN IF NOT EXISTS ticket_key TEXT;
ALTER TABLE actions ADD COLUMN IF NOT EXISTS ticket_url TEXT;

-- 2. Add source_type for filtering actions by origin
ALTER TABLE actions ADD COLUMN IF NOT EXISTS source_type TEXT;
COMMENT ON COLUMN actions.source_type IS 'Origin: org_survey, system_assessment, or manual';

-- 3. Ensure action_updates table exists (may already exist from earlier migration)
CREATE TABLE IF NOT EXISTS action_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  update_type TEXT NOT NULL,
  previous_value JSONB,
  new_value JSONB,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_action_updates_action_id ON action_updates(action_id);
CREATE INDEX IF NOT EXISTS idx_actions_source_type ON actions(source_type);

-- RLS for action_updates (same org-scoped pattern as actions)
ALTER TABLE action_updates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'action_updates' AND policyname = 'action_updates_org_isolation'
  ) THEN
    CREATE POLICY action_updates_org_isolation ON action_updates
      FOR ALL
      USING (
        action_id IN (
          SELECT a.id FROM actions a
          JOIN profiles p ON p.organisation_id = a.organisation_id
          WHERE p.id = auth.uid()
        )
      );
  END IF;
END $$;
```

**Step 2: Verify migration syntax**

Run: `cd /Users/robfanshawe/trustindex && npx supabase migration list 2>&1 | tail -5` (if supabase CLI available) or visually review SQL.

**Step 3: Commit**

```bash
git add supabase/migrations/012_actions_and_reports_fixes.sql
git commit -m "feat: add schema for ticket integration, source_type, and action_updates table"
```

---

### Task 2: Settings Account — Org Size Dropdown + Org Name Owner Guard

**Files:**
- Modify: `src/app/dashboard/settings/page.tsx`

**Step 1: Replace org size text input with dropdown**

Replace lines 129–136 (the company_size `<input>`) with a `<select>` dropdown. Options: `1–10`, `11–50`, `51–200`, `201–500`, `501–1,000`, `1,001–5,000`, `5,001–10,000`, `10,001–50,000`, `50,000+`.

```tsx
// Define at top of file, after imports:
const ORG_SIZE_OPTIONS = [
  "1–10",
  "11–50",
  "51–200",
  "201–500",
  "501–1,000",
  "1,001–5,000",
  "5,001–10,000",
  "10,001–50,000",
  "50,000+",
];
```

Replace the company_size `<input>` block (lines 129–136):
```tsx
<div className="space-y-1">
  <label className="text-sm font-medium text-muted-foreground">Organisation size</label>
  <select
    className="w-full border border-border rounded px-3 py-2 text-sm bg-background"
    value={companySize}
    onChange={(e) => setCompanySize(e.target.value)}
  >
    <option value="">Select size...</option>
    {ORG_SIZE_OPTIONS.map((opt) => (
      <option key={opt} value={opt}>{opt}</option>
    ))}
  </select>
</div>
```

**Step 2: Guard org name editing to owner only**

The component needs access to `profile.role`. It already has `profile` from `useAuth()`. Wrap the company name input: if `profile?.role !== "owner"`, render it as read-only text; otherwise show the editable input.

Replace lines 120–128 (the company_name `<input>` block):
```tsx
<div className="space-y-1">
  <label className="text-sm font-medium text-muted-foreground">Organisation name</label>
  {profile?.role === "owner" ? (
    <input
      className="w-full border border-border rounded px-3 py-2 text-sm"
      value={companyName}
      onChange={(e) => setCompanyName(e.target.value)}
      placeholder="Your company or organisation"
    />
  ) : (
    <div className="text-sm text-muted-foreground px-3 py-2 border border-border rounded bg-muted/50">
      {companyName || "Not set"}
      <span className="text-xs ml-2 text-muted-foreground/60">(Only the account owner can change this)</span>
    </div>
  )}
</div>
```

**Step 3: Build and verify**

Run: `npm run build`

**Step 4: Commit**

```bash
git add src/app/dashboard/settings/page.tsx
git commit -m "fix: org size dropdown with enterprise ranges, guard org name to owner role"
```

---

### Task 3: Organisation Page — Contextual Error Messaging + Always-Show Add Buttons

**Files:**
- Modify: `src/app/dashboard/settings/organisation/page.tsx`

**Step 1: Add HRIS status fetch to `fetchAll`**

After the existing three parallel fetches (line 57), add a fourth fetch for HRIS connection status:

```tsx
const fetchAll = useCallback(async () => {
  setLoading(true);
  setError(null);
  try {
    const [subsRes, fnsRes, teamsRes, hrisRes] = await Promise.all([
      fetch("/api/org/subsidiaries"),
      fetch("/api/org/functions"),
      fetch("/api/org/teams"),
      fetch("/api/integrations/hibob/status").catch(() => null),
    ]);
    if (!subsRes.ok || !fnsRes.ok || !teamsRes.ok) throw new Error("fetch_failed");
    const [subsData, fnsData, teamsData] = await Promise.all([
      subsRes.json(),
      fnsRes.json(),
      teamsRes.json(),
    ]);
    const hrisData = hrisRes && hrisRes.ok ? await hrisRes.json() : null;
    setSubsidiaries(subsData.subsidiaries ?? []);
    setFunctions(fnsData.functions ?? []);
    setTeams(teamsData.teams ?? []);
    setHrisConnected(!!hrisData?.connected);
  } catch (err) {
    const code = err instanceof Error ? err.message : "unknown";
    setError(code);
  } finally {
    setLoading(false);
  }
}, []);
```

Add state for HRIS (after line 39):
```tsx
const [hrisConnected, setHrisConnected] = useState(false);
```

**Step 2: Replace the error banner with contextual messaging**

Replace the error banner (lines 191–201) with:

```tsx
{error && (
  <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
    {error === "fetch_failed" && hrisConnected ? (
      <>
        We couldn&apos;t load data from your HRIS. Check your connection on the{" "}
        <a href="/dashboard/settings/integrations" className="underline font-medium">Integrations page</a>{" "}
        or add structure manually below.
      </>
    ) : error === "fetch_failed" ? (
      <>
        Unable to load organisation structure. Please try again or contact support.
      </>
    ) : (
      <>
        {error}
        <button onClick={() => setError(null)} className="ml-2 underline hover:no-underline">Dismiss</button>
      </>
    )}
  </div>
)}

{/* Empty state guidance (show when no data and no error) */}
{!error && !loading && subsidiaries.length === 0 && functions.length === 0 && teams.length === 0 && (
  <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
    No organisation structure yet. Add subsidiaries, functions and teams below
    {!hrisConnected && (
      <>, or <a href="/dashboard/settings/integrations" className="text-brand underline">connect an HRIS</a> on the Integrations page to import automatically</>
    )}.
  </div>
)}
```

**Step 3: Always show Add buttons**

The Add buttons in each section already render for owners (lines 207–214, 282–289, 375–382). They're visible regardless of whether items exist. The real issue is the empty-state text. Currently, lines 217–220 show "No subsidiaries defined" with no action prompt. Replace each empty-state message to include an inline prompt encouraging the owner to add:

For Subsidiaries (line 217–220):
```tsx
{subsidiaries.length === 0 && !addingSub && (
  <p className="text-sm text-muted-foreground">
    No subsidiaries defined yet.{" "}
    {isOwner && (
      <button onClick={() => setAddingSub(true)} className="text-brand underline">Add your first subsidiary</button>
    )}
  </p>
)}
```

Apply same pattern for Functions (lines 292–294) and Teams (lines 386–388).

**Step 4: Build and verify**

Run: `npm run build`

**Step 5: Commit**

```bash
git add src/app/dashboard/settings/organisation/page.tsx
git commit -m "fix: contextual error messaging for org page, always-show add prompts"
```

---

### Task 4: Actions — Fix Note Saving + Add Due Date Picker

**Files:**
- Modify: `src/app/actions/page.tsx`

**Step 1: Debug the note saving issue**

The frontend calls `POST /api/actions/${id}/updates` with `{ type: "note", content }`. The API route at `src/app/api/actions/[actionId]/updates/route.ts` maps `type: "note"` to `update_type: "note_added"` and inserts into `action_updates`. The likely issue is that the `action_updates` table doesn't exist yet (it may not have been in a previous migration). The migration in Task 1 creates it with `CREATE TABLE IF NOT EXISTS`. No code change needed here — the migration fixes it.

Verify by checking if the frontend silently catches the error. Currently line 215 has `catch { // silent }`. Add error feedback so users know when saving fails:

Replace the `handleAddNote` function (lines 202–220):
```tsx
const [noteError, setNoteError] = useState<string | null>(null);

const handleAddNote = async () => {
  if (!selectedAction || !noteText.trim()) return;
  setAddingNote(true);
  setNoteError(null);
  try {
    const res = await fetch(`/api/actions/${selectedAction.id}/updates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "note", content: noteText.trim() }),
    });
    if (res.ok) {
      setNoteText("");
      loadUpdates(selectedAction.id);
    } else {
      const d = await res.json().catch(() => ({}));
      setNoteError(d.error || "Failed to save note");
    }
  } catch {
    setNoteError("Network error — please try again");
  } finally {
    setAddingNote(false);
  }
};
```

Add below the "Save note" button (after line 551):
```tsx
{noteError && (
  <div className="text-xs text-destructive mt-1">{noteError}</div>
)}
```

**Step 2: Add due date picker to the detail panel**

In the detail panel badges section (around line 472), after the existing due date badge, add a clickable due-date picker. Add state:

```tsx
const [editingDueDate, setEditingDueDate] = useState(false);
const [dueValue, setDueValue] = useState("");
const [savingDue, setSavingDue] = useState(false);
```

Replace the due date badge in the detail panel (lines 472–480) with an interactive version:

```tsx
{/* Due date — editable */}
<div className="flex items-center gap-1.5">
  {editingDueDate ? (
    <div className="flex items-center gap-1">
      <input
        type="date"
        value={dueValue}
        onChange={(e) => setDueValue(e.target.value)}
        className="border border-border rounded px-1.5 py-0.5 text-[10px] bg-background"
        autoFocus
      />
      <button
        type="button"
        disabled={savingDue}
        onClick={async () => {
          if (!selectedAction) return;
          setSavingDue(true);
          try {
            const res = await fetch(`/api/actions/${selectedAction.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ due_date: dueValue || null }),
            });
            if (res.ok) {
              const data = await res.json();
              setSelectedAction(data.action);
              setActions((prev) => prev.map((a) => a.id === data.action.id ? data.action : a));
              loadUpdates(selectedAction.id);
            }
          } catch {} finally {
            setSavingDue(false);
            setEditingDueDate(false);
          }
        }}
        className="text-[10px] text-brand hover:underline"
      >
        {savingDue ? "..." : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setEditingDueDate(false)}
        className="text-[10px] text-muted-foreground hover:underline"
      >
        Cancel
      </button>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => {
        setDueValue(selectedAction?.due_date?.split("T")[0] ?? "");
        setEditingDueDate(true);
      }}
      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
        selectedAction?.due_date
          ? new Date(selectedAction.due_date) < new Date() && selectedAction.status !== "done"
            ? "bg-destructive/10 text-destructive"
            : "bg-muted text-muted-foreground"
          : "bg-muted text-muted-foreground border border-dashed border-muted-foreground/30"
      }`}
    >
      {selectedAction?.due_date
        ? `Due ${new Date(selectedAction.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
        : "Set due date"}
    </button>
  )}
</div>
```

**Step 3: Build and verify**

Run: `npm run build`

**Step 4: Commit**

```bash
git add src/app/actions/page.tsx
git commit -m "fix: note saving error feedback, add inline due date picker to action detail"
```

---

### Task 5: Actions — Create Ticket Section (Generic Integration)

**Files:**
- Modify: `src/app/actions/page.tsx`

**Step 1: Add ticket section to the detail panel**

After the "Add note" section (after line 552 area), add a "Create ticket" section. This checks if the action already has a `ticket_key` and if an integration is connected.

Add to the Action type (around line 13):
```tsx
ticket_provider: string | null;
ticket_key: string | null;
ticket_url: string | null;
```

Add after the "Add note" section in the detail panel:
```tsx
{/* Create ticket / linked ticket */}
<div className="mb-4">
  <div className="text-xs font-medium text-muted-foreground mb-1.5">
    Backlog
  </div>
  {selectedAction.ticket_key ? (
    <div className="flex items-center gap-2 text-xs">
      <span className="px-2 py-0.5 rounded-full bg-brand/10 text-brand font-medium">
        {selectedAction.ticket_provider ?? "Ticket"}
      </span>
      <a
        href={selectedAction.ticket_url ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand underline"
      >
        {selectedAction.ticket_key}
      </a>
    </div>
  ) : (
    <p className="text-xs text-muted-foreground">
      Connect a partner on the{" "}
      <a href="/dashboard/settings/integrations" className="text-brand underline">
        Integrations page
      </a>{" "}
      to create tickets from actions.
    </p>
  )}
</div>
```

**Step 2: Build and verify**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/app/actions/page.tsx
git commit -m "feat: add backlog ticket section to action detail panel"
```

---

### Task 6: Reports — Owner Role Access Fix + Contact Admin Link

**Files:**
- Modify: `src/app/reports/page.tsx` (lines 102–138)

**Step 1: Verify reportAuth.ts already includes owner**

Read `src/lib/reportAuth.ts`. It already has `"owner"` in `REPORT_ACCESS` for all report types, so the permission matrix is correct.

The real bug: the Account settings page `role` field is free-text (users type "CTO", "GRC Lead", etc.) but `reportAuth.ts` expects exact values like `"owner"`, `"exec"`, `"admin"`. The role dropdown needs to use specific values.

**Step 2: Fix the Account settings Role field to be a dropdown**

In `src/app/dashboard/settings/page.tsx`, replace the role `<input>` (lines 139–145) with a `<select>`:

```tsx
// Add constant at top of file:
const ROLE_OPTIONS = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "exec", label: "Executive" },
  { value: "operator", label: "Operator" },
  { value: "risk", label: "Risk" },
];
```

Replace the role input:
```tsx
<div className="space-y-1">
  <label className="text-sm font-medium text-muted-foreground">Role</label>
  <select
    className="w-full border border-border rounded px-3 py-2 text-sm bg-background"
    value={role}
    onChange={(e) => setRole(e.target.value)}
  >
    <option value="">Select role...</option>
    {ROLE_OPTIONS.map((opt) => (
      <option key={opt.value} value={opt.value}>{opt.label}</option>
    ))}
  </select>
</div>
```

**Step 3: Improve the "no access" message on Reports page**

In `src/app/reports/page.tsx`, replace the no-access section (lines 102–138). The heading should say "No reports access" and show a useful message with link:

```tsx
if (permitted.length === 0) {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Trust governance analytics and reporting
        </p>
      </div>
      <div className="border border-border rounded-xl p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-lg font-medium text-foreground mb-2">
          Reports require a role assignment
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
          Your current role does not have access to reports. Ask your account
          owner to assign you a recognised role (Owner, Admin, Executive,
          Operator, or Risk) in{" "}
          <a href="/dashboard/settings" className="text-brand underline">Account Settings</a>.
        </p>
      </div>
    </div>
  );
}
```

**Step 4: Build and verify**

Run: `npm run build`

**Step 5: Commit**

```bash
git add src/app/dashboard/settings/page.tsx src/app/reports/page.tsx
git commit -m "fix: role dropdown with report-compatible values, improve no-access reports message"
```

---

### Task 7: Survey Results — Add "What This Means" + Methodology + Completion to System Assessment

**Files:**
- Modify: `src/app/trustsys/[assessmentId]/results/[runId]/page.tsx`

**Step 1: Add MethodologyOverlay import**

Add to imports (top of file):
```tsx
import MethodologyOverlay from "@/components/MethodologyOverlay";
```

**Step 2: Add MethodologyOverlay next to the Overall Score**

After the "Overall Score" text (around line 307–308), add the methodology button:
```tsx
<div className="flex items-center gap-2">
  <div className="text-sm text-muted-foreground">Overall Score</div>
  <MethodologyOverlay module="sys" />
</div>
```

**Step 3: Add "What this means" band interpretation section**

After the Score hero card (after the closing `</div>` around line 355), add a new section. Reuse the `bandFor` helper from the org survey results — extract to a shared utility or define inline:

```tsx
{/* What this means */}
<div className="border border-border rounded-xl p-6 space-y-3">
  <div className="text-sm text-muted-foreground">What this means</div>
  {(() => {
    const score = overall;
    const band =
      score < 40
        ? { label: "Fragile", color: "text-destructive", summary: "Low trust signals systemic friction and elevated risk. Immediate remediation recommended." }
        : score < 70
          ? { label: "Mixed", color: "text-warning", summary: "Some trust foundations exist but inconsistencies create vulnerability. Targeted improvements needed." }
          : { label: "Strong", color: "text-success", summary: "Solid trust infrastructure in place. Focus on maintaining and iterating." };
    return (
      <>
        <div className={`text-xl font-semibold ${band.color}`}>
          {band.label} trust ({score}/100)
        </div>
        <div className="text-sm text-muted-foreground">{band.summary}</div>
        <div className="text-sm text-muted-foreground">
          Recommended next step: Review risk flags and accept recommendations as actions to address the weakest dimensions.
        </div>
      </>
    );
  })()}
</div>
```

**Step 4: Add Completion section (assessor tracking)**

Before the "Actions bar" section (before the final `<div className="flex items-center gap-3 ...">` around line 489), add a completion section. System assessments have a single assessor, so this is simpler than the survey version:

```tsx
{/* Completion */}
<div className="border border-border rounded-xl p-6 space-y-3">
  <h2 className="text-lg font-semibold">Assessment completion</h2>
  <div className="text-sm text-muted-foreground">
    Completed runs: {completedRuns.length} {"\u00b7"} Current version: v{currentRun.version_number}
  </div>
  <div className="space-y-2">
    {completedRuns.slice(0, 5).map((r) => (
      <div key={r.id} className="flex items-center justify-between text-sm">
        <div className="text-muted-foreground">
          v{r.version_number} — {r.completed_at
            ? new Date(r.completed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
            : "In progress"}
        </div>
        <div className={r.overall_score !== null ? "text-foreground font-medium" : "text-muted-foreground"}>
          {r.overall_score !== null ? `${r.overall_score}/100` : "—"}
        </div>
      </div>
    ))}
  </div>
</div>
```

**Step 5: Move CSV export to bottom**

The CSV export button is currently inside the "Actions bar" at the bottom. Ensure it's the last element on the page, matching org survey placement.

**Step 6: Build and verify**

Run: `npm run build`

**Step 7: Commit**

```bash
git add src/app/trustsys/[assessmentId]/results/[runId]/page.tsx
git commit -m "feat: add What This Means, methodology overlay, and completion table to sys assessment results"
```

---

### Task 8: Survey Results — Add "Accept as Action" Buttons to Org Survey Dimensions

**Files:**
- Modify: `src/app/dashboard/surveys/[runId]/results/page.tsx`

**Step 1: Add action creation capability**

The org survey results page shows dimensions with scores. Add an "Accept as Action" button to each dimension, similar to the sys assessment recommendations pattern.

Add state near the top of the component:
```tsx
const [acceptedDims, setAcceptedDims] = useState<Set<string>>(new Set());
const [acceptingDim, setAcceptingDim] = useState<string | null>(null);
```

Add the accept handler:
```tsx
const acceptDimensionAsAction = async (dimension: string, score: number) => {
  setAcceptingDim(dimension);
  try {
    const res = await fetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Improve ${dimension} (scored ${score}/100)`,
        description: `Action generated from TrustOrg survey "${run?.title ?? ""}". The ${dimension} dimension scored ${score}/100, indicating room for improvement.`,
        severity: score < 40 ? "high" : score < 70 ? "medium" : "low",
        linked_run_id: runId,
        linked_run_type: "org",
        dimension_id: dimension.toLowerCase(),
        source_type: "org_survey",
      }),
    });
    if (res.ok) {
      setAcceptedDims((prev) => new Set(prev).add(dimension));
    }
  } catch {} finally {
    setAcceptingDim(null);
  }
};
```

**Step 2: Add buttons to each dimension in the dimensions display**

In the dimension cards section, add an "Accept as Action" button after each dimension's score display. Match the sys assessment's button styling:

```tsx
<div className="shrink-0 self-center">
  {acceptedDims.has(dim.dimension) ? (
    <span className="text-xs text-success font-medium flex items-center gap-1">
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      Action created
    </span>
  ) : (
    <button
      type="button"
      onClick={() => acceptDimensionAsAction(dim.dimension, Math.round(dim.mean_1_to_5 * 20))}
      disabled={acceptingDim === dim.dimension}
      className="text-xs px-2.5 py-1 rounded border border-brand text-brand hover:bg-brand hover:text-white transition-colors disabled:opacity-50 whitespace-nowrap"
    >
      {acceptingDim === dim.dimension ? "Creating..." : "Accept as Action"}
    </button>
  )}
</div>
```

**Step 3: Verify the `/api/actions` POST route accepts `source_type`**

Check `src/app/api/actions/route.ts` — if the POST handler doesn't include `source_type` in the insert, add it.

**Step 4: Build and verify**

Run: `npm run build`

**Step 5: Commit**

```bash
git add src/app/dashboard/surveys/[runId]/results/page.tsx src/app/api/actions/route.ts
git commit -m "feat: add Accept as Action buttons to org survey dimension results"
```

---

### Task 9: Actions Page — Source Type Filter Toggle

**Files:**
- Modify: `src/app/actions/page.tsx`

**Step 1: Add source filter state and UI**

Add to the `Filters` type (line 29):
```tsx
type Filters = {
  status: string;
  severity: string;
  source: string;
};
```

Update `useState<Filters>` initial value to include `source: ""`.

Add a third filter `<select>` in the filters bar (after the severity dropdown, around line 286):
```tsx
<select
  value={filters.source}
  onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))}
  className="border border-border rounded-lg px-3 py-1.5 text-sm bg-card focus:outline-none focus:border-brand"
>
  <option value="">All sources</option>
  <option value="org_survey">Organisation</option>
  <option value="system_assessment">System</option>
  <option value="manual">Manual</option>
</select>
```

**Step 2: Pass source filter to the API**

In `fetchActions` (line 125), add:
```tsx
if (filters.source) params.set("source_type", filters.source);
```

**Step 3: Update the API route to accept source_type filter**

In `src/app/api/actions/route.ts`, add filtering by `source_type` query param alongside existing status/severity filters.

**Step 4: Build and verify**

Run: `npm run build`

**Step 5: Commit**

```bash
git add src/app/actions/page.tsx src/app/api/actions/route.ts
git commit -m "feat: add source type filter (Organisation/System/Manual) to actions page"
```

---

### Task 10: Fix Info Icon Tooltips

**Files:**
- Modify: `src/app/dashboard/surveys/[runId]/results/page.tsx`
- Modify: `src/app/trustsys/[assessmentId]/results/[runId]/page.tsx`
- Modify: `src/app/trustsys/page.tsx` (stability badge `title=` attributes)

**Step 1: Audit all `title=` attributes and info-icon-style elements**

Search both results pages for:
- `title={` attributes (these show native browser tooltips on hover but may be empty)
- `(i)` or `(?)` rendered text that has no click/hover handler
- `MethodologyOverlay` — this one already works (it's a click-to-open modal)

The system assessment list page (`src/app/trustsys/page.tsx`) has `title={stability.tooltip}` on stability badges — these use native HTML `title` which does show on hover but with delay. Convert these to proper visible tooltips.

**Step 2: Create a reusable Tooltip component**

Create `src/components/Tooltip.tsx`:

```tsx
"use client";

import { useState, type ReactNode } from "react";

type Props = {
  content: string;
  children: ReactNode;
};

export default function Tooltip({ content, children }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 rounded bg-foreground text-background text-xs whitespace-nowrap z-50 shadow-lg pointer-events-none">
          {content}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
        </span>
      )}
    </span>
  );
}
```

**Step 3: Replace `title=` attributes with Tooltip component**

In `src/app/trustsys/[assessmentId]/results/[runId]/page.tsx` line 293:
```tsx
// Before:
<span ... title={stabilityBadge.tooltip}>
// After:
<Tooltip content={stabilityBadge.tooltip}>
  <span ...>
    {stabilityBadge.label}
  </span>
</Tooltip>
```

Similarly in `src/app/trustsys/page.tsx` line 369.

**Step 4: Add tooltip text to dimension score cards**

In both results pages, wrap dimension names or score values with tooltips explaining what each dimension measures. Use the descriptions from `MethodologyOverlay` component:

```tsx
const DIMENSION_TOOLTIPS: Record<string, string> = {
  Transparency: "Visibility and clarity of decision-making processes",
  Inclusion: "Psychological safety and participation across the organisation",
  Confidence: "Trust in leadership follow-through and consistency",
  Explainability: "How well decisions can be understood by stakeholders",
  Risk: "Strength of governance controls and escalation paths",
};
```

Wrap each dimension label with: `<Tooltip content={DIMENSION_TOOLTIPS[dim] ?? dim}><span>{dim}</span></Tooltip>`

**Step 5: Build and verify**

Run: `npm run build`

**Step 6: Commit**

```bash
git add src/components/Tooltip.tsx src/app/trustsys/[assessmentId]/results/[runId]/page.tsx src/app/trustsys/page.tsx src/app/dashboard/surveys/[runId]/results/page.tsx
git commit -m "feat: add proper tooltip component, replace title attrs and wire up dimension tooltips"
```
