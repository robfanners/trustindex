# Policies Module Upgrade — Full Lifecycle Governance Policies

**Date:** 2026-03-18
**Status:** Draft — awaiting review

## Problem

Policies today are generate-once documents with no lifecycle management. You can generate via Claude but can't edit, version, export, connect to external tools, or link them to other governance modules. IBG specifications exist but are only reachable through system assessments with no standalone explanation.

## Vision

Policies become first-class governance objects that:
- Are created (AI-generated or uploaded), edited, versioned, approved, and archived
- Auto-connect to compliance frameworks, systems, declarations, and actions
- Sync bidirectionally with Confluence/Notion
- Export as PDF/Word
- Have full provenance (every change is auditable)
- IBG is surfaced as a standalone capability with proper documentation

## Phased Build

### Phase 1: Policy Management Foundation (Session 1)

**New page: `/govern/policies`** — dedicated policy management replacing the copilot dashboard section.

| Feature | Detail |
|---------|--------|
| Policy list | All policies with status, type, version, last updated, linked systems count |
| Policy detail panel | View content, metadata, version history, linked items |
| Create policy | AI-generate (existing flow) OR upload (docx/pdf → extract text → map to template) |
| Edit/redraft | In-app markdown editor for Pro+ plans. Creates new version automatically |
| Status workflow | Draft → Under Review → Active → Archived. Approval required for Active |
| Version history | Timeline showing all versions with diff view |
| Provenance | Every create/edit/approve/archive action logged to audit_logs with full metadata |

**DB changes:**
- Add `title` column to `ai_policies` (currently uses `policy_type` as identifier)
- Add `linked_systems` jsonb to track which systems a policy applies to
- Add `review_status` enum (draft, under_review, approved, active, archived)
- Add `approved_by`, `approved_at` columns

**Navigation:**
- Move from Copilot section to Govern section
- `/govern/policies` becomes the canonical policies page

### Phase 2: Auto-Connection Engine (Session 2)

When a policy is created or updated, automatically:

| Trigger | Action |
|---------|--------|
| New acceptable_use policy | Create declaration template for staff sign-off |
| Policy mentions a system by name | Link policy to that system in `system_policy_links` |
| Policy references a compliance framework | Map to `compliance_frameworks` entry |
| Policy updated | Create action item "Review and communicate policy changes" |
| Policy approved | Log to audit trail, update compliance framework coverage |

**New table: `system_policy_links`**
- `system_id`, `policy_id`, `link_type` (applies_to, references, supersedes)
- Auto-populated during policy creation via keyword matching + manual override

**New table: `policy_events`**
- `policy_id`, `event_type`, `version`, `performed_by`, `metadata`, `created_at`
- Immutable audit trail for every policy lifecycle event

### Phase 3: Export & External Sync (Session 3)

**Export:**
- PDF export using existing jsPDF pipeline (reuse `src/lib/pdfExport.ts` patterns)
- Word export using docx-js
- Both branded with Verisum template, version watermark, provenance hash

**External integration — Confluence:**
- OAuth connection (similar to existing HiBob pattern in `src/app/api/integrations/`)
- Push: On policy approval, publish to configured Confluence space
- Pull: Webhook/polling for external edits → create "pending review" in Verisum
- Pending reviews use assurance grading (Gold/Silver/Bronze from Decision Ledger)
- Changes from external sources flagged with amber review badge until approved internally

**External integration — Notion:**
- Same pattern as Confluence using Notion API
- Sync policy content to Notion database
- Inbound changes create review queue items

### Phase 4: Upload & Template Conversion (Session 4)

**Upload flow:**
- Accept .docx, .pdf, .md uploads
- Extract text content
- **Starter:** Manual mapping — user assigns sections to template fields
- **Pro+:** AI conversion — Claude maps uploaded content to Verisum template automatically, user reviews before saving
- Preserve original as attachment, create structured version as the policy

**Template system:**
- Standardised policy templates for all 10 policy types
- Templates include required sections that map to IBG components
- Each template has compulsory fields that auto-populate related modules

### Phase 5: IBG Learn & Overview Page (Session 5)

**Problem:** IBG is Rob's original IP — a novel governance primitive — but there's no way to learn about it in the product. It's only accessible buried inside system assessments.

**Solution:**
- New page: `/govern/ibg` — "Learn about Intent-Based Governance" page:
  - Explains the three components (authorised goals, decision authorities, blast radius)
  - Why it matters (EU AI Act gap, agentic AI governance)
  - How it connects to Verisum's modules (policies, systems, compliance)
  - Read-only summary of all IBG specs across the org's systems
  - Links to system assessments for actual IBG spec creation/editing
- In-app tooltips explaining IBG on relevant pages (system assessment, policy generation)
- IBG count on Control Centre posture strip
- IBG-driven policies remain in the Policies section (Phase 1)

## Key Files to Modify/Create

| File | Action |
|------|--------|
| `src/app/govern/policies/page.tsx` | **Create** — Policy management page |
| `src/app/api/copilot/policies/route.ts` | **Modify** — Add CRUD (currently GET only) |
| `src/app/api/copilot/policies/[policyId]/route.ts` | **Create** — Individual policy CRUD |
| `src/app/api/copilot/policies/[policyId]/export/route.ts` | **Create** — PDF/Word export |
| `src/app/govern/ibg/page.tsx` | **Create** — IBG overview page |
| `src/lib/navigation.ts` | **Modify** — Update Policies nav, add IBG nav |
| `supabase/migrations/028_policy_lifecycle.sql` | **Create** — Schema changes |

## Dependencies

- Phase 1 is self-contained
- Phase 2 depends on Phase 1
- Phase 3 depends on Phase 1 (export) and Phase 2 (sync triggers)
- Phase 4 depends on Phase 1
- Phase 5 is independent, can be done in parallel with any phase

## Decisions (Resolved)

1. **Policy types** — Curated list of 10 types (not free-text). Contact prompt if org needs another.
   - `acceptable_use` — AI Acceptable Use Policy
   - `data_handling` — AI Data Handling & Privacy
   - `staff_guidelines` — Staff Guidelines & Training
   - `risk_assessment` — AI Risk Assessment Policy
   - `transparency` — Transparency & Explainability
   - `bias_monitoring` — Bias Detection & Mitigation
   - `vendor_management` — AI Vendor Management
   - `incident_response` — AI Incident Response
   - `human_oversight` — Human Oversight & Escalation
   - `model_lifecycle` — Model Lifecycle Governance

2. **External sync priority** — Confluence first, Notion second.

3. **Upload conversion** — Offer both manual and AI mapping. AI conversion is a plan upgrade feature (Pro+). Starter gets manual mapping only.

4. **IBG page** — Not a standalone policy creation page. Instead:
   - `/govern/ibg` is a "Learn about IBG" page explaining the concept (Rob's original IP)
   - Lists all IBG specs across systems (read-only summary)
   - Links to system assessments for actual IBG spec creation
   - IBG-driven policies live in the Policies section, not the IBG section
