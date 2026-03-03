# Copilot UX Improvements — Design Doc

**Date:** 2026-03-03
**Status:** Approved
**Author:** Rob Fanshawe + Claude

## Context

Live testing of the AI Governance Copilot (Starter tier) revealed several UX issues:
- Generate Policy shows raw API error JSON to users
- No rate limits on LLM-powered generation
- Staff Declarations lack context, guidance, and email sharing
- Incident Log entries not editable after creation
- Newly added vendors don't appear in incident form dropdown
- No helper tooltips explaining what each Copilot section does

## 1. Generate Policy — Error UX + Rate Limiting

### Rate Limits
| Tier | Monthly policy generations |
|------|--------------------------|
| Starter | 3 |
| Pro | 10 |
| Enterprise | 50 (BYOK option for unlimited) |

### Implementation
- Add `maxPolicyGenerations(plan)` to `entitlements.ts`
- Count `ai_policies` rows for org this month in the API route
- Return 403 with friendly message when limit reached
- Catch all `generateText()` errors — never expose raw API responses
- If Anthropic returns billing error, log server-side, return generic 503
- Show remaining generation count in the UI

### AI Disclosure
- Info banner at top of generate-policy form:
  > "Policies are generated using AI and tailored to your organisation's context. Always review generated content before adopting."
- Small (?) tooltip on the "Generate policy" button in CopilotDashboard

### Error Messages
- Generation failure: "Policy generation is temporarily unavailable. Please try again in a few minutes."
- Rate limit hit: "You've used all 3 policy generations this month. Upgrade for more."
- No raw JSON, no stack traces, no API error codes shown to users

## 2. Staff Declarations — UX Overhaul

### Model
Campaign-based with email tracking. One shareable link per campaign, with optional email invites to track responses.

### UI Changes
- **Helper tooltip** on section title: "Collect AI usage declarations from staff. Create a campaign link, invite your team, and track responses."
- **Better label field**: Placeholder "e.g. Q1 2026 AI Usage Declaration", helper text "Give this campaign a clear name so you can identify it later"
- **Date stamps**: Show `created_at` in readable format next to each token
- **Share via email button**: Opens compose modal with:
  - Comma-separated email input
  - Pre-written professional email body (editable) explaining what declarations are, why they matter, link to submit
  - Send via Resend integration

### Email Tracking
- New `declaration_invites` table:
  ```sql
  id uuid PK DEFAULT gen_random_uuid()
  token_id uuid FK -> declaration_tokens(id)
  email text NOT NULL
  sent_at timestamptz DEFAULT now()
  submitted_at timestamptz  -- set when matched submission found
  ```
- Match submissions to invites by email on declaration submit
- UI shows: "Sent: 15 / Submitted: 8 / Pending: 7"

### Professional Email Template
Subject: "AI Usage Declaration — [Company Name]"
Body explains:
- What the declaration is (brief)
- Why it matters (governance compliance)
- What they need to do (click link, 5 min form)
- Link to the declaration form
- Signed from the organisation name

## 3. Incident Log — Editable with Audit Trail

### Editability
- Add "Edit" button on each incident card (except closed incidents)
- Opens inline edit form with all fields: title, description, vendor, impact level, resolution notes
- Save updates via existing PATCH endpoint

### Audit Trail
- Add columns to `incidents` table:
  ```sql
  edited_at timestamptz
  edited_by uuid FK -> profiles(id)
  ```
- PATCH endpoint sets `edited_at = now()` and `edited_by = user.id` on every update
- Status changes also update audit fields

### UI
- "Edited" badge on modified incidents
- Tooltip on badge: "Last edited by [name] on [date]"

## 4. Vendor → Incident Dropdown Sync

### Fix
- Refetch vendors from `/api/vendors` each time the "Log incident" form is opened
- Trigger `fetchVendors()` when `showAdd` transitions to `true`
- Ensures any vendors added during the same session appear in the dropdown

## 5. Helper Tooltips Across Copilot

### Implementation
- Use existing `<Tooltip>` component
- Add (?) icon inline with each Section title in CopilotDashboard

### Tooltip Text
| Section | Text |
|---------|------|
| Governance Setup | Complete the setup wizard to generate your AI governance framework — policies, inventory, and gap analysis. |
| Governance Pack | Download your generated governance documents. Re-run the wizard to generate updated versions. |
| Monthly Report | Automated monthly summary of your AI governance posture, emailed on the 1st of each month. |
| AI Policies | Generate tailored AI governance policies using AI. Policies are customised to your organisation's context. |
| Staff Declarations | Collect AI usage declarations from staff. Create a campaign link, invite your team, and track responses. |
| AI Vendor Register | Track and assess all AI tools used across your organisation. Vendors are auto-added from staff declarations. |
| Incident Log | Record AI-related incidents and near-misses. Maintain an audit trail for governance compliance. |
| Regulatory Updates | Stay current with AI governance regulations and guidance relevant to your jurisdiction. |

## Files Affected

### New files
- `src/app/api/declarations/invite/route.ts` — send email invites
- `supabase/migrations/016_copilot_ux_improvements.sql` — declaration_invites table, incident audit columns, policy gen limits

### Modified files
- `src/lib/entitlements.ts` — `maxPolicyGenerations()` function
- `src/app/api/copilot/generate-policy/route.ts` — rate limiting, error handling
- `src/app/copilot/generate-policy/page.tsx` — AI disclosure, friendly errors, remaining count
- `src/components/copilot/CopilotDashboard.tsx` — tooltips on all sections, declaration UI overhaul
- `src/components/copilot/IncidentLog.tsx` — edit form, audit badge, vendor refetch
- `src/app/api/incidents/route.ts` — PATCH audit fields
- `src/lib/emailTemplates.ts` — declaration invite template

## Out of Scope
- BYOK (bring your own API key) for Enterprise — future iteration
- Bulk email import (CSV) for declarations — future iteration
- Full field-level changelog for incidents — simple audit trail is sufficient for now
