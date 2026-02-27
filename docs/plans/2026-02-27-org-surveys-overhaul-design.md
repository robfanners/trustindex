# Org Surveys Overhaul + Header Redesign — Design Document

**Date:** 2026-02-27
**Status:** Approved
**Approach:** Layered Build (schema → settings → form → header → integrations → HiBob → cleanup)

---

## 1. Database Schema — Org Hierarchy (Migration 011)

### New Tables

**`subsidiaries`**

| Column          | Type        | Notes                                    |
|-----------------|-------------|------------------------------------------|
| id              | uuid PK     | gen_random_uuid()                        |
| organisation_id | uuid FK     | → organisations(id) ON DELETE CASCADE    |
| name            | text        | NOT NULL                                 |
| created_at      | timestamptz | DEFAULT now()                            |
| updated_at      | timestamptz | DEFAULT now()                            |

**`functions`**

| Column          | Type        | Notes                                         |
|-----------------|-------------|-----------------------------------------------|
| id              | uuid PK     | gen_random_uuid()                             |
| organisation_id | uuid FK     | → organisations(id) ON DELETE CASCADE         |
| subsidiary_id   | uuid FK     | → subsidiaries(id), NULLABLE (org-wide)       |
| name            | text        | NOT NULL                                      |
| is_project_type | boolean     | DEFAULT false, TRUE = auto-created "Project"  |
| created_at      | timestamptz | DEFAULT now()                                 |
| updated_at      | timestamptz | DEFAULT now()                                 |

**`teams`**

| Column          | Type        | Notes                                          |
|-----------------|-------------|-------------------------------------------------|
| id              | uuid PK     | gen_random_uuid()                               |
| organisation_id | uuid FK     | → organisations(id) ON DELETE CASCADE           |
| function_id     | uuid FK     | → functions(id)                                 |
| name            | text        | NOT NULL                                        |
| is_adhoc        | boolean     | DEFAULT false, TRUE = project-created ad-hoc    |
| created_at      | timestamptz | DEFAULT now()                                   |
| updated_at      | timestamptz | DEFAULT now()                                   |

**`survey_scope`** (junction: survey run ↔ hierarchy selections)

| Column        | Type    | Notes                              |
|---------------|---------|------------------------------------|
| id            | uuid PK | gen_random_uuid()                  |
| survey_run_id | uuid FK | → survey_runs(id) ON DELETE CASCADE|
| subsidiary_id | uuid FK | NULLABLE                           |
| function_id   | uuid FK | NULLABLE                           |
| team_id       | uuid FK | NULLABLE                           |

**`integration_connections`** (OAuth token storage for HRIS etc.)

| Column           | Type        | Notes                                   |
|------------------|-------------|-----------------------------------------|
| id               | uuid PK     | gen_random_uuid()                       |
| organisation_id  | uuid FK     | → organisations(id) ON DELETE CASCADE   |
| provider         | text        | NOT NULL ('hibob', 'slack', etc.)       |
| status           | text        | 'connected', 'disconnected', 'error'   |
| access_token     | text        | encrypted                               |
| refresh_token    | text        | encrypted                               |
| token_expires_at | timestamptz |                                         |
| last_synced_at   | timestamptz |                                         |
| sync_config      | jsonb       | import preferences, frequency           |
| created_at       | timestamptz | DEFAULT now()                           |
| updated_at       | timestamptz | DEFAULT now()                           |

### Key Design Decisions

- When an organisation is created, a "Project" function is auto-seeded (`is_project_type = true`)
- Functions can optionally belong to a subsidiary (`subsidiary_id` nullable = org-wide function)
- Ad-hoc teams under "Project" function are marked `is_adhoc = true`
- RLS policies: org-scoped access, matching existing patterns
- Legacy `invites.team/level/location` free-text fields remain for backward compat; new form writes to `survey_scope`
- `updated_at` auto-trigger applied to all new tables

---

## 2. Org Management Settings Page

**Route:** `/dashboard/settings/organisation`

### Layout: Three stacked cards

**Card 1: Subsidiaries**
- Table: name | edit | delete
- "Add Subsidiary" button → inline or modal name entry
- Permission-gated: Owner role or `manage_org_structure` permission

**Card 2: Functions**
- Table: name | parent subsidiary (or "Org-wide") | type badge ("Project" = system-managed)
- "Add Function" button → fields: Name, Subsidiary (optional dropdown)
- "Project" function shown but not editable/deletable
- Same permission gate

**Card 3: Teams**
- Table: name | function | ad-hoc badge
- "Add Team" button → fields: Name, Function (required dropdown)
- Ad-hoc teams show badge
- Same permission gate

### Permissions

- View: any authenticated org member
- Edit/Create/Delete: Owner role or users with `manage_org_structure` permission
- Permission stored as `permissions` jsonb on profiles for now (upgrade to RBAC table later)

---

## 3. Survey Creation Form Overhaul

**Route:** `/dashboard/surveys/new` (refactored in-place)

### New field order

1. **Survey Name** (text, required)
   - Tooltip: "Give your survey a descriptive name for future reference"

2. **Organisation Name** (text)
   - Inside company instance: pre-filled, read-only
   - Explorer Free: hidden (captured at signup)

3. **Subsidiary** (multi-select dropdown)
   - Options: "N/A" + all subsidiaries from org setup
   - "Add" button: greyed unless user has `manage_org_structure` permission
   - Tooltip: "Select the subsidiary or subsidiaries this survey covers. Choose N/A if subsidiaries don't apply to your organisation."
   - "N/A" = no cascading filter on Functions

4. **Function** (multi-select dropdown, cascading)
   - Shows functions for selected subsidiaries + org-wide functions + "Project" (always)
   - If subsidiary = "N/A": shows all org functions
   - "Add" button: same permission gate
   - Selecting "Project" enables ad-hoc team creation in Team field

5. **Team** (multi-select dropdown, cascading)
   - Shows teams for selected functions
   - For "Project" function: existing project teams + "Create new team" (free-text)
   - "Add" button: same permission gate

6. **Survey type** — Explorer / Organisational (unchanged)
7. **Invite count** — number input (unchanged)

### Removed
- Old "Optional segmentation" collapsible with free-text Team/Level/Location

---

## 4. Header Redesign

**File:** `AuthenticatedShell.tsx` — top bar only (sidebar unchanged)

### New layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [☰] Logo │ [Module ▾] │ [🔍 Search…                    ] │ [+] │ [🤖][🔔][?][👤▾] │
│ mobile   │ left       │ center                           │     │ right             │
└────────────────────────────────────────────────────────────────────────────┘
```

### Left cluster
- Mobile hamburger (existing)
- Logo/brand (existing)
- **Module Switcher** — dropdown: TrustOrg Surveys, TrustSys Assessments, Actions, Reports. Navigates to section. Shows current module from pathname.

### Centre
- **Global Search** — `Cmd+K`/`Ctrl+K`. Modal overlay. Searches surveys, assessments, actions, org entities. Results grouped by type.

### Right of centre
- **Quick Create (+)** — dropdown: "New TrustOrg Survey", "New TrustSys Assessment", "New Action"

### Right cluster
- **AI Assistant** — sparkle icon, placeholder, tooltip "Coming soon"
- **Notifications (bell)** — functional. Badge count from: pending actions, overdue reassessments, drift alerts, survey completions. Dropdown with recent items.
- **Help (?)** — dropdown: Documentation (external), Contact Support (mailto), What's New (placeholder)
- **User Avatar/Menu** — replaces email + logout. Dropdown: email label, plan badge, "Settings", "Log out"

### Responsive
- Mobile: search → icon that expands, module switcher hidden (sidebar handles this), quick create stays, notifications stays, user menu stays

---

## 5. Integrations Page Reorg + HiBob

**Route:** `/dashboard/settings/integrations` (overhauled)

### Categories (natural language, not functional jargon)

**People & Talent**
- HiBob (functional: OAuth + sync)
- Deel (Coming Soon)
- Workday (Coming Soon)
- ADP (Coming Soon)
- Rippling (Coming Soon)
- Personio (Coming Soon)

**Communication & Collaboration**
- Slack (Coming Soon)
- Microsoft Teams (Coming Soon)

**Project & Delivery**
- Jira (Coming Soon)

**Governance, Risk & Compliance**
- GRC Export (Coming Soon)

### HiBob Integration

- **OAuth 2.0** flow → tokens stored in `integration_connections`
- **API endpoints used:** GET /people, GET /company/structure
- **Sync:** Initial on-connect + manual "Sync now" + optional scheduled
- **Mapping:** HiBob divisions → subsidiaries, departments → functions, teams → teams
- **Conflict resolution:** HiBob data merged with manual entries; manual entries preserved
- **UI:** Connected status, last sync time, "Sync now" button, disconnect option, sync settings

---

## 6. Legacy Cleanup

- **AppShell.tsx:** Remove `{ label: "Create survey", href: "/admin/new-run" }` from `navItems`
- No other AppShell changes in this pass

---

## 7. Bug Fixes

- Fix Unicode rendering in results page: `\u00b7` → `·`, `\u2026` → `…` (literal escaped strings showing instead of characters in Survey Completion section)

---

## Implementation Order (Layered Build)

1. Migration 011 — org hierarchy + integration_connections tables
2. Org Management settings page — CRUD for subsidiaries/functions/teams
3. Survey creation form overhaul — cascading multi-selects
4. Header redesign — modern B2B command centre
5. Integrations page reorg — categorised by natural-language type
6. HiBob integration — OAuth + org structure sync
7. Legacy cleanup — remove "Create survey" from AppShell
8. Bug fixes — Unicode rendering
