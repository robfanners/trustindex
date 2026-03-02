# Starter Tier Self-Serve Redesign

**Date:** 2026-03-02
**Status:** Approved
**Author:** Rob Fanshawe + Claude

## Problem

Starter (£79/mo) is ~85% built — Copilot features (policies, declarations, vendors, incidents, regulatory feed) all work. But two critical gaps remain:

1. **No compelling onboarding artefact.** The pricing page promises board-ready outputs, but there's no "hand this to your investor" moment. Individual tools exist, but nothing packages them into a governance pack.
2. **Monthly compliance report not implemented.** API stub exists, no generation logic.

Additionally, Starter's tier structure includes 3 TrustOrg surveys — an enterprise governance maturity tool that doesn't align with the SME buyer's needs.

## Strategic Context

- **The artefact sells, the platform retains.** The initial governance pack gets SMEs to pay. Ongoing Copilot tools (declarations, vendor tracking, incidents, monthly reports) keep them subscribed.
- **The pack has a shelf life.** AI governance is a moving target — regulatory changes, staff turnover, new tools. A governance pack from March 2026 is stale by September. Date-stamped, versioned packs create natural renewal.
- **Tier restructure:** Starter = Copilot, Pro = Copilot + TrustOrg, Enterprise = Copilot + TrustOrg + TrustSys. Each tier adds depth, not size.

## Design

### 1. AI Governance Setup Wizard

New route at `/setup`. Primary CTA on the Starter dashboard when no wizard has been completed. Also accessible after Starter upgrade as the onboarding experience.

**Step 1 — Company Profile** (~2 min)
- Company name, industry (dropdown), headcount range, jurisdiction (UK/EU/Other)
- Feeds the policy generator and governance statement context

**Step 2 — AI Tool Inventory** (~5 min)
- Multi-select from common AI tools (ChatGPT, GitHub Copilot, Claude, Midjourney, Gemini, custom/other) + free-text
- For each tool: purpose (dropdown: content creation, code assistance, data analysis, customer-facing, internal ops), departments using it, data classification (public, internal, personal, sensitive)
- Pre-populates the vendor register

**Step 3 — Control Posture** (~5 min)
8-10 questions, mix of yes/no and simple scale:
- "Do you have an AI usage policy?" (yes / no / partial)
- "Do staff need approval before using AI tools?" (yes / no / for some tools)
- "Are AI outputs reviewed by a human before use?" (always / sometimes / never)
- "Do you log which AI tools are used and for what?" (yes / no / partially)
- "Have staff been trained on responsible AI use?" (yes / no / planned)
- "Do you have a process for handling AI-related incidents?" (yes / no / informal)
- "Do you assess vendors before adopting new AI tools?" (yes / no / sometimes)
- "Is there a named person responsible for AI governance?" (yes / no)

**Step 4 — Review & Generate** (~3 min)
- Summary of collected data
- "Generate your AI Governance Pack" button
- Progress indicator during PDF generation

**Data storage:** New `governance_wizard` table:
- `id` (uuid, PK)
- `org_id` (uuid, FK → organisations)
- `version` (integer, auto-increment per org)
- `responses` (jsonb — all wizard answers)
- `completed_at` (timestamptz)
- `created_at` (timestamptz)

Re-run support: Users can re-run at any time. New version created, previous versions retained for comparison.

### 2. Governance Pack

Three PDF documents generated from wizard data + Copilot data.

#### AI Governance Statement (2-3 pages)
The headline artefact. LLM-generated (Claude API) using wizard answers as context:
- Company AI governance commitment (tone-appropriate for industry)
- Summary of AI tools in use and their purposes
- Key controls in place (from control posture answers)
- Identified gaps and planned improvements
- Named governance responsibility
- Date-stamped, versioned ("v1.0 — March 2026")

This replaces the current single policy generator. Instead of choosing one policy type, the wizard generates a comprehensive governance statement.

#### AI Usage Inventory (1-2 pages)
Structured table from wizard Step 2 + vendor register:
- Tool name | Purpose | Data classification | Department | Risk category
- Auto-populated from wizard, editable via vendor register after generation

#### Risk & Gap Summary (1-2 pages)
Generated from control posture answers (Step 3):
- Top 5 governance gaps (where answers were "no" or "never")
- Recommended actions for each gap (LLM-generated, practical)
- Simple visual indicator (red/amber/green per area)
- Links to relevant regulatory guidance from the regulatory feed

**Format:** Branded PDFs (Verisum/TrustGraph header, company name, date, version number). Download individually or as combined pack.

**Generation pipeline:**
1. Claude API call → governance statement text (from wizard answers)
2. Template-based PDF → usage inventory (from wizard Step 2 + vendors table)
3. Claude API call → gap analysis + recommendations (from wizard Step 3)
4. jsPDF renders all three as branded PDFs
5. Stored in `governance_packs` table (or regenerated on demand from wizard data)

**Regeneration:** Re-running the wizard or updating Copilot data (new vendors, declarations) allows regenerating the pack. New version, old version kept.

### 3. Monthly Compliance Report

Automated monthly PDF summarising governance posture. Sent on 1st of each month via email.

**Contents (Starter — basic, 1-2 pages):**
- Governance pack status (current version, last updated)
- Declaration compliance: X of Y staff declared (% complete)
- Vendor register: total vendors, risk breakdown
- Incidents this month: count, severity, open vs resolved
- Regulatory updates: key items from past month
- Recommended actions: top 3 things to address this month

**Implementation:**
1. Cron trigger (Make.com webhook or Vercel cron) → `/api/copilot/monthly-report`
2. API aggregates Copilot data for each active Starter+ org
3. Generates PDF via jsPDF
4. Sends via Resend to org owner's email
5. Stores in `monthly_reports` table for dashboard access

### 4. Starter Tier Restructure

**Current entitlements:**
- 3 TrustOrg surveys, 0 TrustSys, Copilot features

**New entitlements:**
- Governance Setup Wizard (unlimited re-runs)
- Governance Pack (3 documents, regenerable)
- Staff Declaration Portal (25 staff)
- AI Vendor Register (10 vendors)
- Incident Logging (5/month)
- Regulatory Feed (UK/EU)
- Monthly Compliance Report (basic)
- 0 TrustOrg surveys (moved to Pro)
- 0 TrustSys assessments (stays Enterprise)

**Upgrade page:** Rewrite Starter column to lead with outcome:
> "Get your AI governance sorted in 30 minutes. Guided setup, instant governance pack, ongoing compliance tools."

### 5. Email Integration

Hook up Resend for transactional emails:
- Welcome email on Starter signup
- Governance pack ready notification
- Monthly report delivery
- Declaration reminders (day 3, 7 after token creation)

## Tier Structure (Updated)

| Tier | Price | Core | Assessment | Copilot Limits |
|------|-------|------|-----------|----------------|
| Explorer | Free | Dashboard preview | None | None |
| Starter | £79/mo | Copilot + Wizard + Pack | Governance Wizard | 25 staff, 10 vendors, 5 incidents/mo |
| Pro | £199/mo | Copilot + TrustOrg | 5 org surveys + Wizard | 100 staff, unlimited vendors/incidents |
| Enterprise | Custom | Copilot + TrustOrg + TrustSys | Unlimited | Unlimited + integrations |

## What This Does NOT Include

To keep scope manageable and protect Enterprise positioning:
- No Trust Posture Score (can add later as enhancement)
- No risk bands / Investor Prudence Index (future iteration)
- No investor due diligence appendix (future, based on demand)
- No badge/verification system (needs brand recognition first)
- No re-certification flow (natural re-run of wizard suffices for now)
- No relational Org-to-Sys graph (Enterprise only)
- No dynamic thresholds or runtime monitoring

## Future Enhancements (Post-Launch)

Based on user feedback and demand:
1. Trust Posture Score (0-100) derived from wizard answers
2. Risk bands (Experimental / Managed / Controlled / Investor-Ready)
3. Investor Due Diligence Appendix (data room format)
4. Annual re-certification with version comparison
5. Shareable governance badge for websites
6. Pro monthly report (richer, with TrustOrg trends)
