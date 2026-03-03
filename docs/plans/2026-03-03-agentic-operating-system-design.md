# Verisum Agentic Operating System Design

**Date:** 2026-03-03
**Status:** Draft — Awaiting Approval
**Author:** Rob Fanshawe + Claude

---

## 1. Vision

Verisum operates as a native AI company with human orchestration. Claude acts as an operational co-pilot — executing routine work, preparing decisions, and managing the toolstack — while Rob provides strategic direction, relationship management, and final sign-off.

This isn't "AI assistance." It's a co-founder operating model where Claude has direct access to the business systems and autonomously handles operational tasks within approved boundaries. Rob orchestrates; Claude executes.

**Core principle: Automate the gathering, prepare the action, human approves.**

This model also serves as a live demonstration of the Human-HarmonAI philosophy and the TrustGraph product — Verisum dogfoods its own governance tools.

---

## 2. Operating Rhythms

### 2.1 Daily Pulse (Automated — No Rob Input)

Make.com scenarios post key signals to Slack throughout the day:

| Signal | Source | Slack Channel |
|--------|--------|--------------|
| **Sales & Revenue** | | |
| New signup (Explorer or paid) | Stripe webhook / Supabase | #revenue |
| Payment received | Stripe webhook | #revenue |
| Payment failed / churn | Stripe webhook | #revenue |
| Explorer → paid conversion | Stripe webhook | #revenue |
| **Marketing & Content** | | |
| LinkedIn post engagement (likes, comments, shares) | LinkedIn / Make.com | #marketing |
| Medium / blog article views | Medium API / Make.com | #marketing |
| Website traffic spike | PostHog / analytics | #marketing |
| Inbound lead (contact form / demo request) | Website / Supabase | #marketing |
| **Product** | | |
| New wizard completion | Supabase trigger | #product |
| Governance pack generated | Supabase trigger | #product |
| Feature adoption signals (first declaration, first vendor added) | Supabase trigger | #product |
| Error spike / build failure | Hostinger / Supabase logs | #product |
| Build deployed | Hostinger git push | #product |

Rob glances at Slack when convenient. No action required unless something's flagged red. Over time, conversion ratios (Explorer → Starter, trial → paid, feature activation rates) are calculated in the Monday co-work session and tracked week-over-week.

### 2.2 Monday Co-Work Session (30-60 min)

A structured Claude Code session every Monday. Claude prepares everything before Rob starts reviewing.

**The Monday Playbook:**

#### Phase 1: Metrics Review (Claude prepares, Rob reviews — 5 min)
- Pull Stripe MRR, new subscribers, churn, failed payments
- Pull Supabase: active users (7d), new signups, feature adoption
- Pull Apollo: pipeline status, new leads, sequence performance
- Pull Linear: completed last week, open this week, blockers
- Present as a "Weekly Pulse" summary

#### Phase 2: Pipeline & Outreach (Claude prepares, Rob approves — 15 min)
- Apollo: identify top prospects from enrichment + sequences
- Draft personalised LinkedIn messages / emails for top 5-10 prospects
- Review any inbound leads from Explorer signups
- Rob approves/edits outreach, Claude sends via Apollo sequences

#### Phase 3: Product & Operations (Claude executes, Rob reviews — 10 min)
- Linear triage: re-prioritise backlog based on metrics + customer feedback
- Notion updates: ship notes, doc updates flagged during the week
- Regulatory feed: any new items to add? (Claude drafts, Rob approves)
- Review any customer support items or bug reports

#### Phase 4: Content & Strategy (Rob drives, Claude assists — 15 min)
- Draft 1-2 LinkedIn posts for the week (Claude writes, Rob edits voice)
- Review consulting pipeline — any proposals needed?
- Strategic decisions queue — anything parked that needs a call?

#### Phase 5: Week Ahead (5 min)
- Claude updates Linear with the week's priorities
- Set any reminders or follow-ups
- "Ship list" — what's getting deployed this week?

### 2.3 Ad-Hoc Sessions (As Needed)

Rob drops into Claude Code for specific tasks:
- "Research this prospect before my call"
- "Draft a consulting proposal for [company]"
- "Debug this production issue"
- "Build this feature" (enters the dev workflow — plan → branch → build → deploy)
- "Update the regulatory feed with this new ICO guidance"

---

## 3. Execution Model

### 3.1 Claude Executes, Rob Approves

For anything Claude has MCP/API access to, the pattern is:
1. Claude performs the action
2. Claude reports what was done
3. Rob confirms or requests changes

This applies to: Supabase operations, Hostinger deploys, Apollo contacts/sequences, git operations, Slack notifications, email sends, Linear updates.

### 3.2 Claude Prepares, Rob Clicks

For tools requiring browser access:
1. Claude prepares the content/configuration
2. Claude guides Rob through the 2-3 clicks needed
3. Or Claude uses Chrome automation with Rob watching

This applies to: Stripe dashboard actions, Make.com scenarios, hPanel env vars.

### 3.3 Rob Drives, Claude Assists

For strategic, creative, and product work:
1. Rob sets direction
2. Claude drafts/researches/builds
3. Rob refines with their judgement and voice

This applies to: product vision and prioritisation, sales calls, investor conversations, brand decisions, content voice, partnership strategy. Product decisions — what to build, for whom, and why — remain human-driven. Claude executes the implementation, but Rob owns the "what" and "why."

---

## 4. Connector Architecture

### 4.1 Current MCP Connections (Direct API Access)

| Tool | MCP | Capabilities |
|------|-----|-------------|
| Supabase | ✅ | Full DB access, migrations, edge functions, storage, logs |
| Hostinger | ✅ | Deploy, DNS, domains, websites, SSL |
| Apollo | ✅ | People/company search, enrichment, contacts, sequences |
| Context7 | ✅ | Library documentation lookup |
| Chrome | ✅ | Browser automation for any web tool |

### 4.2 API Access via Bash/Curl

| Tool | Method | Key Actions |
|------|--------|-------------|
| Stripe | `stripe` CLI or curl | List payments, customers, subscriptions, MRR |
| Linear | GraphQL API via curl | Create/update issues, list cycles, query backlog |
| Slack | Incoming webhooks via curl | Post messages to channels |
| Resend | REST API via curl | Send transactional emails |
| Notion | REST API via curl | Create/update pages, query databases |

### 4.3 Browser-Only (Chrome MCP)

| Tool | Method | Key Actions |
|------|--------|-------------|
| Make.com | Chrome automation | Build/edit scenarios (no public API) |
| Stripe Dashboard | Chrome automation | Create products/prices, view analytics |
| hPanel | Chrome automation | Environment variables, settings |

### 4.4 Future Additions (When Revenue Justifies)

| Tool | Purpose | Trigger |
|------|---------|---------|
| Xero / FreeAgent | Accounting, VAT, invoicing | When consulting revenue > £5k/mo or first hire |
| PostHog | Product analytics | When WAU > 100 |
| Calendly / Cal.com | Meeting scheduling | When sales calls > 5/week |
| HRIS | People management | When team > 3 |

---

## 5. Dogfooding — TrustGraph on Verisum

Verisum registers as an organisation in its own TrustGraph platform. This serves three purposes:

1. **Product validation** — Find bugs, UX issues, and missing features by using the product daily
2. **Sales collateral** — "Here's our governance pack. We generated it with TrustGraph."
3. **Credibility** — A trust company that governs its own AI usage

### 5.1 Verisum's AI Governance Profile

**AI tools in use:**
| Tool | Purpose | Data Classification |
|------|---------|-------------------|
| Claude Code | Product development, operational co-pilot | Internal + some customer context |
| Claude API | Policy generation for customers | Customer data (anonymised prompts) |
| Apollo.io | CRM, prospecting, enrichment | Personal data (business contacts) |
| Make.com | Automation orchestration | Internal operational data |
| Resend | Transactional email | Personal data (email addresses) |
| GitHub Copilot | Code assistance (if used) | Source code |
| Stripe | Payment processing | Financial data (handled by Stripe) |

**Governance actions:**
- Run the AI Governance Setup Wizard for Verisum
- Generate Verisum's own Governance Pack (statement + inventory + gap analysis)
- Rob submits a staff declaration (yes, even as solo founder — proves the flow works)
- Register all AI vendors in the vendor register
- Monthly compliance reports generated for Verisum itself

### 5.2 HAPP Integration (Future — Parking Lot)

Apply HAPP provenance verification to Verisum's own AI-generated documents:
- Governance packs carry HAPP provenance certificates
- Monthly reports are HAPP-verified
- AI policies show generation chain (wizard answers → Claude API → PDF)
- Demonstrates the full stack: TrustGraph for governance + HAPP for provenance

This is a future enhancement — noted here for strategic context. Design separately when the governance dogfooding is complete and HAPP merge strategy is ready.

---

## 6. Monday Playbook — Technical Implementation

### 6.1 Metrics Pull (Claude executes automatically at session start)

```
1. Stripe → curl stripe API
   - MRR (sum of active subscriptions)
   - New subscribers this week
   - Churned this week
   - Failed payments

2. Supabase → MCP execute_sql
   - New signups (profiles created this week)
   - Active users (profiles with activity in last 7 days)
   - Wizard completions this week
   - Governance packs generated

3. Apollo → MCP
   - Pipeline: contacts in active sequences
   - New leads enriched this week
   - Sequence reply rates

4. Linear → curl GraphQL API
   - Issues completed last week
   - Issues in current cycle
   - Blockers / high priority items

5. Format as "Weekly Pulse" summary
```

### 6.2 Outreach Preparation (Claude drafts, Rob approves)

```
1. Apollo → search for prospects matching ICP
   - SMEs, 10-200 employees
   - Industries: agencies, consultancies, recruiters, accountants, startups
   - UK/EU based
   - Using AI tools (technology filter)

2. Enrich top prospects (Apollo MCP)

3. Draft personalised outreach for top 5-10:
   - LinkedIn connection request + message
   - Or email sequence entry
   - Personalised to their industry + AI usage signals

4. Present to Rob for review/edit

5. On approval: add to Apollo sequence (Apollo MCP)
```

### 6.3 Content Drafting

```
1. Review week's shipping (git log)
2. Draft 1-2 LinkedIn posts:
   - Product update / feature announcement
   - AI governance insight / thought leadership
3. Rob edits for voice and tone
4. Schedule or post (Chrome automation to LinkedIn)
```

---

## 7. Automation Flows (Make.com + Direct)

### Flow 1: Daily Pulse — Stripe → Slack
**Status:** Scenario 1 live (Stripe checkout → Slack #alerts)
**Remaining:** Add payment failed, subscription cancelled triggers

### Flow 2: Signup → Onboarding
**Status:** Code built (welcome email template in Resend)
**Remaining:** Wire Make.com scenario: Supabase new profile → Resend welcome email → Slack alert → Notion CRM row

### Flow 3: Monthly Compliance Report
**Status:** Code built (API endpoint + PDF generation)
**Remaining:** Fix CRON_SECRET auth issue with Make.com trigger (parked — debug in implementation phase)

### Flow 4: Weekly Business Digest
**Status:** Not started
**Implementation:** Make.com scheduled scenario (Monday 7am) OR handled directly in Monday co-work session (recommended — more flexible, Claude can pull live data)

### Flow 5: Lead Capture → CRM
**Status:** Not started
**Implementation:** Explorer signup → Make.com → Apollo contact creation → sequence assignment → Slack notification

---

## 8. What This Does NOT Include

To stay focused and avoid over-engineering:

- No custom AI agents running autonomously (Claude operates within sessions, not 24/7)
- No automated decision-making without Rob's approval
- No financial transactions without explicit sign-off
- No social media auto-posting (Claude drafts, Rob publishes)
- No HRIS/payroll until team > 1
- No accounting integration until consulting revenue > £5k/mo
- HAPP integration is a separate future design

---

## 9. Success Criteria

| Metric | 30 Days | 90 Days |
|--------|---------|---------|
| Monday co-work sessions completed | 4/4 | 12/13 |
| Outreach contacts per week | 10+ | 25+ |
| Time saved per week (Rob's estimate) | 3-5 hrs | 8-10 hrs |
| Pipeline value (Apollo) | £5k+ | £25k+ |
| Verisum dogfooding complete | Wizard + pack done | Monthly reports running |
| Automation flows live | 2/5 | 5/5 |

---

## 10. Implementation Priority

1. **Unblock production** — env vars, Stripe Starter, Make.com cron fix
2. **Dogfood TrustGraph** — register Verisum as org, run wizard, generate pack
3. **First Monday playbook** — run the full cycle once manually to test the flow
4. **Wire automation flows** — Stripe alerts, signup onboarding, weekly digest
5. **Start outreach** — Apollo prospect identification + sequence setup
6. **Iterate** — refine playbook based on what works, drop what doesn't
