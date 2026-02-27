# UX Fixes and Results Harmonisation Design

**Date:** 2026-02-27

---

## 1. Settings Fixes

### 1a. Account Page — Org Size Dropdown

Replace the free-text `company_size` input with a `<select>` dropdown.

Options (signal enterprise readiness):
- `1–10`
- `11–50`
- `51–200`
- `201–500`
- `501–1,000`
- `1,001–5,000`
- `5,001–10,000`
- `10,001–50,000`
- `50,000+`

Pre-filled from `profile.company_size` (sourced from onboarding via `ti_onboarding_pending`). The onboarding flow should use the same dropdown options.

### 1b. Account Page — Org Name Editability

Add a guard: only `role === "owner"` can edit `company_name`. Non-owners see it read-only. Value is pre-filled from onboarding and persists via `/api/settings/profile` PATCH.

### 1c. Organisation Page — Error Messaging

Replace the generic "Failed to load data" banner with contextual messages. Fetch HRIS status from `/api/integrations/hibob/status` alongside hierarchy data.

| Condition | Message |
|---|---|
| No hierarchy data, no HRIS connected | "No organisation structure yet. Add subsidiaries, functions and teams below, or connect an HRIS on the Integrations page to import automatically." |
| HRIS connected but sync/fetch failed | "We couldn't load data from your HRIS. Check your connection on the Integrations page or add structure manually below." |
| HRIS connected, data loaded | (No message, show data normally) |

### 1d. Organisation Page — Always Show Add Buttons

Currently the Add button only appears when items exist. Fix: always render the Add form trigger in each section (Subsidiaries, Functions, Teams) so owners can populate from scratch, even when the section is empty.

---

## 2. Actions Fixes

### 2a. Note Saving Bug

The detail panel POSTs to `/api/actions/${id}/updates` with `{ type: "note", content }`. Trace the API route and fix the failure — likely a missing table, RLS policy gap, or column mismatch. Verify the `action_updates` table exists, has correct columns (`action_id`, `type`, `content`, `created_at`, `created_by`), and RLS allows insert for authenticated users scoped to their org.

### 2b. Due Date Entry

The "Due" column displays `action.due_date` but there is no UI to set it. Add:

- Inline date picker in the action detail panel (click due date or "Set due date" placeholder).
- PATCH to `/api/actions/${id}` to persist.
- Show due date in the detail panel header alongside status badge.

### 2c. Create Backlog Ticket (Generic Integration)

Below "Add Note" in the action detail panel, add a **"Create ticket"** section.

**Display logic:**
- If a project-management integration is connected → button reads **"Create [Provider] ticket"** (e.g. "Create Jira ticket", "Create Linear ticket").
- If no integration connected → button reads **"Create Backlog ticket"** and a prompt says *"Connect a partner on the Integrations page to create tickets from actions."*
- If action already has a linked ticket → show the ticket reference (key + link) instead of the create button.

**Data flow:**
- On click, POST to `/api/integrations/[provider]/tickets` with action title, description, due date.
- Store `ticket_provider`, `ticket_key`, `ticket_url` on the action record.
- Sync endpoint polls linked tickets and updates action status on transition (e.g. Jira "Done" → action marked complete).

**Auth model:** Jira Cloud uses OAuth 2.0 (per-user). Tokens stored in `integration_connections` with `provider = 'jira'`. Other providers follow the same pattern.

### 2d. Schema Additions

```sql
-- actions table
ALTER TABLE actions ADD COLUMN ticket_provider TEXT;
ALTER TABLE actions ADD COLUMN ticket_key TEXT;
ALTER TABLE actions ADD COLUMN ticket_url TEXT;
ALTER TABLE actions ADD COLUMN source_type TEXT; -- 'org_survey', 'system_assessment', 'manual'
```

Ensure `action_updates` table exists with: `id`, `action_id`, `type`, `content`, `created_at`, `created_by`.

---

## 3. Reports Fix

### 3a. Owner Role Access

In `canAccessReport(role, report)` and `accessibleReports(role)`, add `owner` as a recognised role with full access (equivalent to `admin` — all 5 report tabs).

### 3b. Contact Admin Link

Replace plain text "Contact your administrator" with:
- If current user is NOT the owner → show a button that opens a pre-filled message or mailto to the org owner's email (fetch from profiles where `role = 'owner'` and same org).
- If current user IS the owner → they now have full access (per 3a), so this message no longer appears for them.

---

## 4. Survey Results UI Harmonisation

### 4a. From Org Survey → Apply to System Assessment

| Pattern | Source | Target |
|---|---|---|
| "What this means" band interpretation (Fragile/Mixed/Strong + summary + recommended next step) | Org Survey results | System Assessment results |
| Methodology overlay button next to score | Org Survey results | System Assessment results |
| Completion table (adapted: assessors completed vs pending) | Org Survey results | System Assessment results |
| CSV export button placement at bottom | Org Survey results | System Assessment results |

### 4b. From System Assessment → Apply to Org Survey

| Pattern | Source | Target |
|---|---|---|
| Card-based layout and format | System Assessment results | Org Survey results |
| "Accept as Action" buttons on dimensions/insights | System Assessment results (on recommendations) | Org Survey results (on dimensions) |

### 4c. Actions Page Source Filter

Add a filter toggle to the Actions list page:

- **All** (default) — mixed list of all actions
- **Organisation** — actions where `source_type = 'org_survey'`
- **System** — actions where `source_type = 'system_assessment'`

### 4d. Info Icon Tooltips

Audit all `(i)` and `(?)` icons across both results pages. These currently render with no hover content. Fix: wrap each in a tooltip component with contextual help text explaining the metric, score band, or methodology concept.

---

## Files Affected

| Area | Files |
|---|---|
| Settings Account | `src/app/dashboard/settings/page.tsx`, `src/app/api/settings/profile/route.ts` |
| Settings Organisation | `src/app/dashboard/settings/organisation/page.tsx` |
| Actions | `src/app/actions/page.tsx`, `src/app/api/actions/[id]/route.ts`, `src/app/api/actions/[id]/updates/route.ts` |
| Actions Jira | `src/app/api/integrations/jira/` (new), `src/lib/jira.ts` (new), `src/app/dashboard/settings/integrations/page.tsx` |
| Reports | `src/app/reports/page.tsx` |
| Org Survey Results | `src/app/dashboard/surveys/[runId]/results/page.tsx` |
| Sys Assessment Results | `src/app/trustsys/[assessmentId]/results/[runId]/page.tsx` |
| Schema | `supabase/migrations/012_actions_and_reports_fixes.sql` |
