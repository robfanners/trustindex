# Verisum Business Operating System Design

**Date:** 2026-02-27
**Author:** Rob Fanshawe + Claude (co-founder session)
**Status:** Approved

---

## 1. Context

Verisum is a solo-founder business with three revenue streams:

1. **AI Governance Copilot SaaS** (primary — recurring revenue via TrustGraph platform)
2. **Consulting/advisory** (immediate cashflow — AI governance expertise)
3. **Licensing/partnerships** (longer cycle — HAPP + Human-HarmonAI IP)

The TrustGraph platform (`~/trustindex`) already has a production-ready scoring engine, Stripe billing, PDF export, and a 3-tier pricing model (Explorer/Pro/Enterprise). The goal is to enhance it into an SME-friendly AI Governance Copilot and build the surrounding business operating system for a solo founder.

### Assets Inventory

| Asset | Location | Status |
|-------|----------|--------|
| TrustGraph platform | `~/trustindex` (GitHub: robfanners/trustindex) | Active — Next.js 16 + Supabase |
| Verisum marketing site | `~/verisum.org` (GitHub: robfanners/verisum-org) | Active — static HTML |
| HAPP codebase | `~/happ` | Active — separate product (future merge planned) |
| Business documents | OneDrive: `Work/Verisum/` | Needs cleanup — migrating to Notion |
| Human-HarmonAI IP | OneDrive: `Work/Verisum/Human-HarmonAI/` | White papers, playbook, framework docs |

---

## 2. Product Design — AI Governance Copilot

### 2.1 Positioning

**Tagline:** "AI compliance sorted in 48 hours."

**Value prop:** A lightweight subscription tool for SMEs deploying AI. Not enterprise GRC. Not consulting. Just: "Are we safe using AI? Are we compliant? Are we covered?"

**Target segments:** Digital agencies, marketing firms, recruitment firms, consultancies, accounting firms, tech startups — all using AI without governance.

**Pricing:** £79–199/month. Target: 200 customers = £20k/month.

### 2.2 Pricing Tiers

| Feature | Explorer (Free) | Starter (£79/mo) | Pro (£199/mo) | Enterprise (Custom) |
|---------|----------------|-------------------|---------------|---------------------|
| Org Assessments | 1 | 3 | 5 | Unlimited |
| System Assessments | 0 | 0 | 2 | Unlimited |
| AI Policy Generator | - | Auto-generated (1) | Auto-generated + editable | Custom templates |
| Staff Declaration Portal | - | Up to 25 staff | Up to 100 staff | Unlimited + SSO |
| AI Vendor Register | - | 10 vendors | Unlimited | + risk scoring |
| Monthly Compliance PDF | - | Basic snapshot | Full board-ready report | Custom branding |
| Incident Logging | - | 5/month | Unlimited | + workflow routing |
| Regulatory Feed | - | UK/EU summary | UK/EU + sector-specific | Custom jurisdictions |
| CSV Export | No | No | Yes | Yes |
| Team Management | No | No | No | Yes |
| Greyed-out Pro features | Yes | Yes (Pro greyed) | Full access | Full access |

**Key change from current:** Adding Starter tier at £79/mo as lower-friction entry. Keeping Explorer free for lead gen. Pro stays at £199. All paid tiers include the AI Governance Copilot features at different capacity levels.

### 2.3 New Features to Build

#### A. AI Policy Generator (Starter + Pro)

- LLM-powered document generation (Claude API via provider-agnostic wrapper)
- Onboarding questionnaire: industry, size, AI tools used, data sensitivity, jurisdiction
- Generates: AI Acceptable Use Policy, Data Handling Addendum, Staff Guidelines
- Pro: editable + re-generate; Starter: read-only auto-generated
- Stored in Supabase, versioned, exportable as PDF/DOCX
- **New tables:** `ai_policies` (org_id, policy_type, version, content, generated_by, status)
- **New API:** `POST /api/copilot/generate-policy`

#### B. Staff AI Usage Declaration Portal (Starter + Pro)

- Org admin gets shareable link (token-based, no auth required for staff)
- Staff self-declare: AI tools used, data input types, frequency
- Auto-feeds AI Vendor Register
- Dashboard shows declaration compliance rate (% staff declared)
- **New tables:** `staff_declarations` (org_id, token, staff_name, staff_email, tools_declared, data_types, frequency, declared_at)
- **New API:** `GET/POST /api/declarations/[token]`

#### C. AI Vendor Register (Starter + Pro)

- Auto-populated from staff declarations + manual add
- Fields: vendor, data processing location, data types shared, risk level (auto-scored)
- Maps to EU AI Act risk categories (minimal/limited/high/unacceptable)
- Pro: full risk scoring engine; Starter: basic list
- **New tables:** `ai_vendors` (org_id, vendor_name, vendor_url, data_location, data_types, risk_category, auto_scored, manual_override)

#### D. Monthly Compliance PDF (Starter + Pro)

- Scheduled via Vercel cron (1st of month)
- Pulls: health score, actions status, declaration compliance %, vendor count, incidents
- Starter: 1-page snapshot; Pro: full board-ready multi-page report
- Emailed via Resend + downloadable from dashboard
- Built on existing `jsPDF` + `html2canvas` pipeline
- **New API:** `POST /api/copilot/monthly-report` (triggered by cron)

#### E. Incident Logging (Starter + Pro)

- Simplified version of existing escalation schema
- User-friendly form: what happened, which AI tool, impact, resolution status
- Auto-links to relevant vendor in register
- Pro: unlimited + exports; Starter: 5/month
- **New tables:** `incidents` (org_id, title, description, ai_vendor_id, impact_level, resolution, status, reported_by, reported_at)

#### F. Regulatory Feed (Starter + Pro)

- Initially curated markdown content (manual monthly update, ~2 hrs)
- Later: LLM-summarised from authoritative sources (ICO, EU AI Office, etc.)
- UK AI governance + EU AI Act updates
- Displayed as feed/timeline in dashboard
- **New tables:** `regulatory_updates` (title, summary, source_url, jurisdiction, published_at, relevance_tags)

### 2.4 Tech Implementation

- **LLM:** `@anthropic-ai/sdk` — Claude Sonnet for doc generation. Wrapped in `src/lib/llm.ts` with provider interface.
- **New API routes:** `/api/copilot/*`, `/api/declarations/*`, `/api/vendors/*`, `/api/incidents/*`
- **New Supabase migrations:** Tables listed above + RLS policies
- **Entitlements:** Extend `src/lib/entitlements.ts` with Starter tier + new feature checks
- **Stripe:** Add Starter price ID, update checkout + webhook for 3 paid tiers
- **Cron:** Vercel cron for monthly report generation
- **Email:** Resend for transactional (welcome, reports, declaration reminders)

---

## 3. Business Operating System

### 3.1 Toolstack

| Function | Tool | Cost | Rationale |
|----------|------|------|-----------|
| CRM & Sales | Apollo.io (connected) | Current plan | LinkedIn-native, enrichment, sequences |
| Project Management | Linear (free tier) | £0 | Fast, keyboard-driven, developer-friendly |
| Knowledge Base | Notion (free → Plus) | £0 → £8/mo | Single source for business docs, SOPs |
| Code | GitHub (robfanners) | £0 | trustindex + verisum-org + happ repos |
| Dev Environment | Claude Code + CLAUDE.md | Within plan | AI co-founder with project memory |
| Billing | Stripe (integrated) | Transaction fees | Subscriptions, invoicing, metrics |
| Email (transactional) | Resend | £0 (up to 3k/mo) | Welcome, reports, declarations |
| Automation | Make.com (free → Core) | £0 → £9/mo | Apollo → Notion → Slack → Stripe |
| Comms/Alerts | Slack (free) | £0 | Notification hub, webhook target |
| Hosting | Vercel (configured) | £0 → £20/mo | Next.js native, cron |
| Database | Supabase (integrated) | £0 → £25/mo | Auth, DB, Edge Functions |
| Analytics | PostHog or Vercel Analytics | £0 | Product usage understanding |

**Monthly cost at launch: ~£0.** Scales to ~£60/mo past free tiers.

### 3.2 Automation Flows

#### Flow 1: Lead Capture → CRM → Outreach
```
LinkedIn / website / Explorer signup
  → Apollo enrichment (auto)
  → Apollo sequence (auto)
  → Slack: "New lead: [name] at [company]" (auto)
  → Rob reviews + personalises if needed (manual sign-off)
```

#### Flow 2: Signup → Onboarding → Activation
```
User signs up (Explorer or paid)
  → Supabase profile + org (existing)
  → Resend welcome email + quickstart (new)
  → Stripe webhook → upgrade plan (existing for paid)
  → Make.com → Notion CRM + Slack alert (new)
  → Day 3: "Run your first assessment?" email (new)
  → Day 7: "Your AI policy is waiting" email (Starter+ only, new)
```

#### Flow 3: Monthly Compliance Report
```
1st of month (Vercel cron)
  → For each Starter/Pro org:
    → Pull health + actions + declarations + vendors + incidents
    → Generate PDF (existing pipeline + new data)
    → Email via Resend (new)
    → Slack: "X reports generated" (new)
  → Rob reviews anomalies (manual)
```

#### Flow 4: Doc Update Loop
```
Product change shipped
  → CLAUDE.md updated (existing pattern)
  → Make.com → Notion task: "Update [doc]"
  → Rob reviews + approves (manual sign-off)
  → Update docs → mark complete
```

#### Flow 5: Weekly Business Digest
```
Every Monday (Make.com)
  → Pull: Stripe MRR, signups, active users
  → Pull: Apollo pipeline, leads
  → Pull: Linear completed/open
  → Slack: "Weekly Pulse" (auto)
  → Rob reviews + sets priorities (manual)
```

### 3.3 Learning Loops

| Loop | Watches | Notification | Action |
|------|---------|-------------|--------|
| Product usage | Feature adoption (PostHog) | Weekly Slack digest | Inform roadmap |
| Churn signals | 14+ day inactive users | Slack alert + draft email | Rob approves send |
| Content gaps | Support questions | Notion tag | Write FAQ / update docs |
| Revenue | MRR, churn, conversion | Weekly Slack digest | Adjust pricing/marketing |
| Regulatory | EU AI Act / UK updates | Monthly Notion task | Rob writes or LLM-drafts for review |

**Rule: automate the gathering, human-approve the action.**

### 3.4 Folder Cleanup & Migration

#### Step 1: Archive
- Zip `OneDrive/Work/Verisum/` as `Verisum_Archive_2026-02-27.zip`
- Store in OneDrive archive location
- Safety net — nothing lost

#### Step 2: Migrate to Notion
Workspace: "Verisum" with sections:
- **Strategy** — Business plan, investor materials, board docs
- **Product** — PRDs, roadmaps, backlogs (linked to Linear)
- **Technology** — Architecture, dev guidelines (linked to GitHub)
- **Operations** — Playbooks, SOPs, onboarding
- **Finance** — Models, projections, pricing
- **Partnerships** — GTM, partner profiles, deal tracking
- **Legal** — IP, trademarks, compliance
- **Human-HarmonAI** — Framework, white papers, implementation
- **Marketing** — Brand, content calendar, campaigns

#### Step 3: Code repos
- `~/trustindex` — Primary product (add CLAUDE.md)
- `~/verisum.org` — Marketing site
- `~/happ` — HAPP codebase (future merge with TrustGraph — roadmap item)
- OneDrive MVP copies → archived (in zip), delete local copies

---

## 4. Future Roadmap Items (Parking Lot)

- **HAPP + TrustGraph merge strategy** — Unify the offerings into a coherent product suite. Rob has a strategy for this; to be designed when tooling is in place.
- **Enterprise tier buildout** — SSO, custom branding, white-label, API access
- **AI Governance Copilot v2** — Chat interface, inline suggestions, agentic workflows
- **HAPP as infrastructure** — Use HAPP protocol for provenance verification within TrustGraph
- **Human-HarmonAI licensing** — Package framework for enterprise licensing deals

---

## 5. Success Criteria

| Metric | 30 days | 90 days | 180 days |
|--------|---------|---------|----------|
| MRR | First paying customer | £2k+ | £10k+ |
| Customers (paid) | 5-10 | 25-50 | 100-200 |
| Explorer signups | 50+ | 200+ | 500+ |
| Conversion (Explorer → paid) | Track baseline | 5%+ | 10%+ |
| Consulting revenue | £5k+ | £15k+ | Reducing (product takes over) |
| Weekly active users | 20+ | 100+ | 300+ |

---

## 6. Implementation Priority

1. **Week 1-2:** Business ops setup (Notion, Linear, Make.com, Slack, CLAUDE.md) + folder cleanup
2. **Week 2-3:** Starter tier + pricing page + Stripe update + greyed-out feature UX
3. **Week 3-5:** AI Policy Generator + Staff Declaration Portal + AI Vendor Register
4. **Week 5-6:** Monthly Compliance PDF + Incident Logging + Regulatory Feed
5. **Week 6-8:** Automation flows (Apollo sequences, onboarding emails, weekly digest)
6. **Ongoing:** Consulting outreach, content marketing, LinkedIn presence, customer feedback loops
