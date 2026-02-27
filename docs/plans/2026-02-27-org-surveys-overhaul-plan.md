# Org Surveys Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Overhaul the org survey creation flow with structured hierarchy (subsidiaries/functions/teams), modernise the header to a B2B command centre, reorganise integrations by category, build a working HiBob HRIS integration, and clean up legacy code.

**Architecture:** Layered build — schema first, then settings CRUD, then survey form, then header, then integrations, then HiBob, then cleanup. Each layer builds on the previous. All data is org-scoped via RLS. The existing AuthenticatedShell sidebar is untouched; only the top bar changes. HiBob uses OAuth 2.0 with token storage in Supabase.

**Tech Stack:** Next.js 16.1 (App Router), React 19, Supabase (Postgres + RLS + Auth), Tailwind CSS 4, TypeScript 5, Stripe (existing billing). No test framework currently — verify via `npm run build` and manual checks.

---

## Task 1: Database Migration — Org Hierarchy + Integration Tables

**Files:**
- Create: `supabase/migrations/011_org_hierarchy_and_integrations.sql`

**Step 1: Write the migration SQL**

```sql
-- ==========================================================================
-- Migration 011: Org Hierarchy + Integration Connections
-- ==========================================================================
-- New tables: subsidiaries, functions, teams, survey_scope, integration_connections
-- Auto-seeds a "Project" function for every existing organisation

-- --------------------------------------------------------------------------
-- 1. subsidiaries
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subsidiaries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_subsidiaries_org ON subsidiaries(organisation_id);

-- --------------------------------------------------------------------------
-- 2. functions
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS functions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  subsidiary_id   uuid REFERENCES subsidiaries(id) ON DELETE SET NULL,
  name            text NOT NULL,
  is_project_type boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_functions_org ON functions(organisation_id);
CREATE INDEX idx_functions_subsidiary ON functions(subsidiary_id);

-- --------------------------------------------------------------------------
-- 3. teams
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  function_id     uuid NOT NULL REFERENCES functions(id) ON DELETE CASCADE,
  name            text NOT NULL,
  is_adhoc        boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_teams_org ON teams(organisation_id);
CREATE INDEX idx_teams_function ON teams(function_id);

-- --------------------------------------------------------------------------
-- 4. survey_scope — junction: survey run <-> hierarchy selections
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS survey_scope (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_run_id uuid NOT NULL REFERENCES survey_runs(id) ON DELETE CASCADE,
  subsidiary_id uuid REFERENCES subsidiaries(id) ON DELETE SET NULL,
  function_id   uuid REFERENCES functions(id) ON DELETE SET NULL,
  team_id       uuid REFERENCES teams(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_survey_scope_run ON survey_scope(survey_run_id);

-- --------------------------------------------------------------------------
-- 5. integration_connections — OAuth token storage
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS integration_connections (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  provider         text NOT NULL,
  status           text NOT NULL DEFAULT 'disconnected',
  access_token     text,
  refresh_token    text,
  token_expires_at timestamptz,
  last_synced_at   timestamptz,
  sync_config      jsonb DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT integration_connections_provider_org_unique
    UNIQUE (organisation_id, provider)
);

CREATE INDEX idx_integration_connections_org ON integration_connections(organisation_id);

-- --------------------------------------------------------------------------
-- 6. updated_at triggers
-- --------------------------------------------------------------------------
CREATE TRIGGER trg_subsidiaries_updated_at BEFORE UPDATE ON subsidiaries
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_functions_updated_at BEFORE UPDATE ON functions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_teams_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_integration_connections_updated_at BEFORE UPDATE ON integration_connections
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- --------------------------------------------------------------------------
-- 7. RLS
-- --------------------------------------------------------------------------
ALTER TABLE subsidiaries             ENABLE ROW LEVEL SECURITY;
ALTER TABLE functions                ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_scope             ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_connections  ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS. For future authenticated access:
-- org-scoped read for any org member
CREATE POLICY "subsidiaries_org_read" ON subsidiaries
  FOR SELECT TO authenticated
  USING (organisation_id IN (
    SELECT organisation_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "functions_org_read" ON functions
  FOR SELECT TO authenticated
  USING (organisation_id IN (
    SELECT organisation_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "teams_org_read" ON teams
  FOR SELECT TO authenticated
  USING (organisation_id IN (
    SELECT organisation_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "survey_scope_org_read" ON survey_scope
  FOR SELECT TO authenticated
  USING (true);  -- scoped via survey_run join

CREATE POLICY "integration_connections_org_read" ON integration_connections
  FOR SELECT TO authenticated
  USING (organisation_id IN (
    SELECT organisation_id FROM profiles WHERE id = auth.uid()
  ));

-- --------------------------------------------------------------------------
-- 8. Auto-seed "Project" function for every existing organisation
-- --------------------------------------------------------------------------
INSERT INTO functions (organisation_id, name, is_project_type)
SELECT id, 'Project', true
FROM organisations
WHERE id IS NOT NULL;
```

**Step 2: Verify migration is valid SQL**

Run: `npm run build`
Expected: Build succeeds (migration isn't auto-run by Next.js, but no syntax issues in TS files)

**Step 3: Commit**

```bash
git add supabase/migrations/011_org_hierarchy_and_integrations.sql
git commit -m "feat: add org hierarchy + integration_connections schema (migration 011)"
```

---

## Task 2: API Routes — Org Hierarchy CRUD

**Files:**
- Create: `src/app/api/org/subsidiaries/route.ts`
- Create: `src/app/api/org/functions/route.ts`
- Create: `src/app/api/org/teams/route.ts`

**Step 1: Create subsidiaries API route**

File: `src/app/api/org/subsidiaries/route.ts`

```typescript
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";

async function getAuthedOrgId() {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return null;
  const db = supabaseServer();
  const { data: profile } = await db
    .from("profiles")
    .select("organisation_id")
    .eq("id", user.id)
    .single();
  return profile?.organisation_id as string | null;
}

export async function GET() {
  const orgId = await getAuthedOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseServer();
  const { data, error } = await db
    .from("subsidiaries")
    .select("id, name, created_at")
    .eq("organisation_id", orgId)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subsidiaries: data });
}

export async function POST(req: Request) {
  const orgId = await getAuthedOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const db = supabaseServer();
  const { data, error } = await db
    .from("subsidiaries")
    .insert({ organisation_id: orgId, name: name.trim() })
    .select("id, name, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subsidiary: data }, { status: 201 });
}

export async function DELETE(req: Request) {
  const orgId = await getAuthedOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id param required" }, { status: 400 });

  const db = supabaseServer();
  const { error } = await db
    .from("subsidiaries")
    .delete()
    .eq("id", id)
    .eq("organisation_id", orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

**Step 2: Create functions API route**

File: `src/app/api/org/functions/route.ts`

```typescript
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";

async function getAuthedOrgId() {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return null;
  const db = supabaseServer();
  const { data: profile } = await db
    .from("profiles")
    .select("organisation_id")
    .eq("id", user.id)
    .single();
  return profile?.organisation_id as string | null;
}

export async function GET(req: Request) {
  const orgId = await getAuthedOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const subsidiaryIds = searchParams.get("subsidiaryIds"); // comma-separated or empty

  const db = supabaseServer();
  let query = db
    .from("functions")
    .select("id, name, subsidiary_id, is_project_type, created_at")
    .eq("organisation_id", orgId)
    .order("name");

  // If subsidiaryIds provided, filter to those subsidiaries + org-wide (null subsidiary_id) + project type
  if (subsidiaryIds) {
    const ids = subsidiaryIds.split(",").filter(Boolean);
    query = query.or(
      `subsidiary_id.in.(${ids.join(",")}),subsidiary_id.is.null,is_project_type.eq.true`
    );
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ functions: data });
}

export async function POST(req: Request) {
  const orgId = await getAuthedOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, subsidiary_id } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const db = supabaseServer();
  const { data, error } = await db
    .from("functions")
    .insert({
      organisation_id: orgId,
      name: name.trim(),
      subsidiary_id: subsidiary_id || null,
    })
    .select("id, name, subsidiary_id, is_project_type, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ function: data }, { status: 201 });
}

export async function DELETE(req: Request) {
  const orgId = await getAuthedOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id param required" }, { status: 400 });

  // Prevent deleting the Project function
  const db = supabaseServer();
  const { data: fn } = await db.from("functions").select("is_project_type").eq("id", id).single();
  if (fn?.is_project_type) {
    return NextResponse.json({ error: "Cannot delete the Project function" }, { status: 403 });
  }

  const { error } = await db
    .from("functions")
    .delete()
    .eq("id", id)
    .eq("organisation_id", orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

**Step 3: Create teams API route**

File: `src/app/api/org/teams/route.ts`

```typescript
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";

async function getAuthedOrgId() {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return null;
  const db = supabaseServer();
  const { data: profile } = await db
    .from("profiles")
    .select("organisation_id")
    .eq("id", user.id)
    .single();
  return profile?.organisation_id as string | null;
}

export async function GET(req: Request) {
  const orgId = await getAuthedOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const functionIds = searchParams.get("functionIds"); // comma-separated

  const db = supabaseServer();
  let query = db
    .from("teams")
    .select("id, name, function_id, is_adhoc, created_at")
    .eq("organisation_id", orgId)
    .order("name");

  if (functionIds) {
    const ids = functionIds.split(",").filter(Boolean);
    query = query.in("function_id", ids);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ teams: data });
}

export async function POST(req: Request) {
  const orgId = await getAuthedOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, function_id, is_adhoc } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!function_id) return NextResponse.json({ error: "function_id is required" }, { status: 400 });

  const db = supabaseServer();
  const { data, error } = await db
    .from("teams")
    .insert({
      organisation_id: orgId,
      function_id,
      name: name.trim(),
      is_adhoc: is_adhoc ?? false,
    })
    .select("id, name, function_id, is_adhoc, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ team: data }, { status: 201 });
}

export async function DELETE(req: Request) {
  const orgId = await getAuthedOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id param required" }, { status: 400 });

  const db = supabaseServer();
  const { error } = await db
    .from("teams")
    .delete()
    .eq("id", id)
    .eq("organisation_id", orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

**Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/app/api/org/
git commit -m "feat: add org hierarchy CRUD API routes (subsidiaries, functions, teams)"
```

---

## Task 3: Org Management Settings Page

**Files:**
- Create: `src/app/dashboard/settings/organisation/page.tsx`
- Modify: `src/app/dashboard/settings/layout.tsx:24-31` (add "Organisation" tab)

**Step 1: Add Organisation tab to settings layout**

In `src/app/dashboard/settings/layout.tsx`, add a new tab entry after "Account":

```typescript
// Insert after line 25 (the Account tab):
  { label: "Organisation", href: "/dashboard/settings/organisation" },
```

The tabs array becomes:
```typescript
const tabs: SettingsTab[] = [
  { label: "Account", href: "/dashboard/settings" },
  { label: "Organisation", href: "/dashboard/settings/organisation" },
  { label: "Billing", href: "/dashboard/settings/billing", planCheck: hasBillingAccess },
  { label: "Team", href: "/dashboard/settings/team", planCheck: canManageTeam },
  { label: "Security", href: "/dashboard/settings/security" },
  { label: "Integrations", href: "/dashboard/settings/integrations" },
  { label: "Data & Export", href: "/dashboard/settings/data", planCheck: canAccessDataSettings },
];
```

**Step 2: Create the Organisation settings page**

File: `src/app/dashboard/settings/organisation/page.tsx`

This is a large component (~350 lines) with three sections: Subsidiaries, Functions, Teams. Each section has:
- A table listing existing items
- An "Add" button that opens inline form
- Edit/Delete actions per row
- Loading states
- Error handling

Key implementation details:
- Fetch subsidiaries, functions, teams from `/api/org/*` on mount
- "Project" function row is non-deletable (check `is_project_type`)
- Ad-hoc teams show a badge
- Functions show their parent subsidiary name (or "Org-wide")
- All CRUD via `fetch()` to the API routes from Task 2
- Refetch list after each mutation
- Permission gate: show "Add" buttons only if user has Owner role (check `profile.role`)

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/app/dashboard/settings/organisation/ src/app/dashboard/settings/layout.tsx
git commit -m "feat: add Org Management settings page (subsidiaries, functions, teams CRUD)"
```

---

## Task 4: Survey Creation Form Overhaul

**Files:**
- Modify: `src/app/dashboard/surveys/new/page.tsx` (full refactor)
- Modify: `src/app/api/create-run/route.ts:134-146` (add survey_scope insertion)

**Step 1: Refactor the survey creation form**

Replace the `NewSurveyForm` component in `src/app/dashboard/surveys/new/page.tsx` with the new form that has:

1. **Survey Name** — text input with tooltip icon
2. **Organisation Name** — pre-filled from `profile.company_name`, read-only if org exists
3. **Subsidiary** — multi-select dropdown. Options: "N/A" + fetched subsidiaries. "Add" button (greyed if not Owner)
4. **Function** — multi-select dropdown, cascading from subsidiary selection. Always includes "Project". "Add" button.
5. **Team** — multi-select dropdown, cascading from function selection. "Create new team" option under Project. "Add" button.
6. **Survey type** — dropdown (unchanged)
7. **Invite count** — number input (unchanged)

Key implementation details:
- Fetch org hierarchy on mount: `GET /api/org/subsidiaries`, `GET /api/org/functions`, `GET /api/org/teams`
- When subsidiary selection changes, refetch functions with `?subsidiaryIds=...`
- When function selection changes, refetch teams with `?functionIds=...`
- "N/A" for subsidiary = no filtering on functions (show all)
- Multi-select implemented as checkboxes in a dropdown panel (custom component, no external deps)
- Submit sends new `scope` array to API alongside existing fields
- Remove the old "Optional segmentation" `<details>` section

**Step 2: Update create-run API to save survey_scope**

In `src/app/api/create-run/route.ts`, after the invites insertion (line ~146), add:

```typescript
// Save survey scope (hierarchy selections)
const scope = body.scope as Array<{
  subsidiaryId?: string;
  functionId?: string;
  teamId?: string;
}> | undefined;

if (scope?.length) {
  const scopeRows = scope.map((s) => ({
    survey_run_id: runId,
    subsidiary_id: s.subsidiaryId || null,
    function_id: s.functionId || null,
    team_id: s.teamId || null,
  }));
  await supabase.from("survey_scope").insert(scopeRows);
}
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/app/dashboard/surveys/new/page.tsx src/app/api/create-run/route.ts
git commit -m "feat: overhaul survey creation form with cascading hierarchy selects"
```

---

## Task 5: Header Redesign

**Files:**
- Modify: `src/components/AuthenticatedShell.tsx` (top bar overhaul)
- Create: `src/components/header/GlobalSearch.tsx`
- Create: `src/components/header/QuickCreate.tsx`
- Create: `src/components/header/NotificationBell.tsx`
- Create: `src/components/header/ModuleSwitcher.tsx`
- Create: `src/components/header/UserMenu.tsx`
- Create: `src/components/header/HelpMenu.tsx`
- Create: `src/app/api/notifications/route.ts`

**Step 1: Create ModuleSwitcher component**

File: `src/components/header/ModuleSwitcher.tsx`

A dropdown button showing the current module (based on pathname). Options:
- TrustOrg Surveys → `/trustorg`
- TrustSys Assessments → `/trustsys`
- Actions → `/actions`
- Reports → `/reports`

Click navigates via `router.push()`. Styled as a subtle dropdown with chevron.

**Step 2: Create GlobalSearch component**

File: `src/components/header/GlobalSearch.tsx`

- Search input in header (expands on mobile via icon click)
- `Cmd+K` / `Ctrl+K` keyboard shortcut opens modal overlay
- Modal: text input + grouped results (Surveys, Assessments, Actions)
- API: `GET /api/search?q=...` — searches across survey_runs.title, trustsys_assessments.system_name, actions.title
- Results are clickable links to the respective detail pages
- Debounced input (300ms)
- Create: `src/app/api/search/route.ts`

**Step 3: Create QuickCreate component**

File: `src/components/header/QuickCreate.tsx`

A "+" button with dropdown:
- "New TrustOrg Survey" → `/dashboard/surveys/new`
- "New TrustSys Assessment" → `/trustsys/new`
- "New Action" → `/actions/new`

Simple dropdown, no complex logic.

**Step 4: Create NotificationBell component**

File: `src/components/header/NotificationBell.tsx`

- Bell icon with red dot badge (count > 0)
- Dropdown showing recent notifications
- Data from: `GET /api/notifications`
- Create: `src/app/api/notifications/route.ts`
  - Queries: actions where status = 'open' and due_date < now (overdue)
  - Queries: reassessment_policies where next_due < now (overdue)
  - Queries: drift_events from last 7 days
  - Returns array of `{ type, title, message, link, created_at }`

**Step 5: Create UserMenu component**

File: `src/components/header/UserMenu.tsx`

Avatar circle (initials from profile.full_name or email[0]) with dropdown:
- Email (non-clickable label)
- Plan badge
- "Settings" → `/dashboard/settings`
- "Log out" → calls signOut()

**Step 6: Create HelpMenu component**

File: `src/components/header/HelpMenu.tsx`

"?" icon with dropdown:
- "Documentation" → external link (placeholder URL)
- "Contact Support" → `mailto:hello@verisum.org`
- "What's New" → placeholder

**Step 7: Update AuthenticatedShell top bar**

Modify the `<header>` in `src/components/AuthenticatedShell.tsx` (lines 114-166) to use the new components:

```
<header>
  [☰ mobile]  [Logo]  [ModuleSwitcher]  [GlobalSearch]  [QuickCreate]  [AI placeholder]  [NotificationBell]  [HelpMenu]  [UserMenu]
</header>
```

Remove: plan badge span, email span, logout button (these move into UserMenu).
AI assistant: sparkle SVG icon, tooltip "Coming soon", no click handler.

**Step 8: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 9: Commit**

```bash
git add src/components/header/ src/components/AuthenticatedShell.tsx src/app/api/notifications/ src/app/api/search/
git commit -m "feat: modernise header — module switcher, search, quick create, notifications, user menu"
```

---

## Task 6: Integrations Page Reorg

**Files:**
- Modify: `src/app/dashboard/settings/integrations/page.tsx` (full rewrite)

**Step 1: Rewrite integrations page with categories**

Replace the entire file. New structure:

- Page header: "Integrations" with subtitle
- Categories rendered as sections with headers:

  **People & Talent**
  - HiBob (active card with "Connect" button → `/api/integrations/hibob/auth`)
  - Deel, Workday, ADP, Rippling, Personio (Coming Soon cards)

  **Communication & Collaboration**
  - Slack, Microsoft Teams (Coming Soon)

  **Project & Delivery**
  - Jira (Coming Soon)

  **Governance, Risk & Compliance**
  - GRC Export (Coming Soon)

Each category is a section with:
- Section header (h3, styled)
- Grid of cards (same card design as current, but active vs coming-soon states)
- Active cards: full opacity, functional button
- Coming Soon cards: opacity-60, disabled button, "Coming Soon" badge

HiBob card shows connection status if connected (fetch from `/api/integrations/hibob/status`).

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/dashboard/settings/integrations/page.tsx
git commit -m "feat: reorganise integrations page by natural-language categories"
```

---

## Task 7: HiBob Integration

**Files:**
- Create: `src/app/api/integrations/hibob/auth/route.ts` (OAuth initiation)
- Create: `src/app/api/integrations/hibob/callback/route.ts` (OAuth callback)
- Create: `src/app/api/integrations/hibob/status/route.ts` (connection status)
- Create: `src/app/api/integrations/hibob/sync/route.ts` (manual sync trigger)
- Create: `src/lib/hibob.ts` (HiBob API client)

**Step 1: Create HiBob API client**

File: `src/lib/hibob.ts`

Handles:
- OAuth 2.0 token exchange
- API calls to HiBob endpoints (GET /people, GET /company/named-lists, GET /metadata/company-structure)
- Token refresh logic
- Type definitions for HiBob API responses

Key implementation: HiBob uses service account API keys OR OAuth. For simplicity, start with API key auth (Basic auth with service account) as HiBob's OAuth is limited. The admin enters their HiBob Service Account ID + Token in the connect flow.

**Step 2: Create auth route**

File: `src/app/api/integrations/hibob/auth/route.ts`

POST handler that:
1. Accepts `{ serviceId, token }` from the frontend (HiBob service account credentials)
2. Validates credentials by calling HiBob API `/people?showInactive=false&limit=1`
3. If valid, stores in `integration_connections` table (provider = 'hibob', access_token = serviceId, refresh_token = token)
4. Returns success

**Step 3: Create status route**

File: `src/app/api/integrations/hibob/status/route.ts`

GET handler: returns connection status, last_synced_at from `integration_connections`.

**Step 4: Create sync route**

File: `src/app/api/integrations/hibob/sync/route.ts`

POST handler that:
1. Fetches HiBob credentials from `integration_connections`
2. Calls HiBob API: `/company/structure` → divisions, departments, teams
3. Maps: divisions → subsidiaries, departments → functions, teams → teams
4. Upserts into org hierarchy tables (match by name, create if not exists)
5. Updates `last_synced_at`
6. Returns sync summary (counts of created/updated)

**Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add src/lib/hibob.ts src/app/api/integrations/hibob/
git commit -m "feat: add HiBob HRIS integration (service account auth + org structure sync)"
```

---

## Task 8: Legacy Cleanup + Bug Fixes

**Files:**
- Modify: `src/components/AppShell.tsx:28` (remove Create survey link)
- Modify: `src/app/dashboard/surveys/[runId]/results/page.tsx` (fix Unicode)

**Step 1: Remove "Create survey" from AppShell**

In `src/components/AppShell.tsx`, remove line 28:
```typescript
// REMOVE this line:
      { label: "Create survey", href: "/admin/new-run" },
```

Make `navItems` start empty and only add items conditionally:
```typescript
  const navItems = useMemo(() => {
    const items: Array<{ label: string; href: string; isActive?: boolean; isExternal?: boolean }> = [];
    // ... rest stays the same
```

**Step 2: Fix Unicode rendering in results page**

In `src/app/dashboard/surveys/[runId]/results/page.tsx`, replace all literal `\u00b7` in JSX text with `&middot;` entity or `{"\u00b7"}`:

Lines 524, 596, 656, 750: Replace ` \u00b7` with ` {"\u00b7"} ` (wrap in JSX expression)

Line 656: Replace `\u2014` with `{"\u2014"}`

These are JSX text content where `\u00b7` is rendered literally instead of as the `·` character. Wrapping in `{"..."}` forces JavaScript string interpretation.

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/components/AppShell.tsx src/app/dashboard/surveys/\[runId\]/results/page.tsx
git commit -m "fix: remove legacy Create Survey header link, fix Unicode rendering in results"
```

---

## Verification Checklist

After all tasks:

1. `npm run build` — succeeds with no errors
2. Manual: Navigate to `/dashboard/settings/organisation` — see CRUD for subsidiaries/functions/teams
3. Manual: Navigate to `/dashboard/surveys/new` — see new form with cascading multi-selects
4. Manual: Check header — module switcher, search (Cmd+K), quick create (+), notifications bell, user menu
5. Manual: Navigate to `/dashboard/settings/integrations` — see categorised layout with HiBob connect
6. Manual: Check AppShell pages (e.g. `/admin/...`) — no "Create survey" link
7. Manual: Navigate to results page — Unicode characters render correctly (`·` not `\u00b7`)
