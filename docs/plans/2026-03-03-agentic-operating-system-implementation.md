# Agentic Operating System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stand up the Verisum Agentic Operating System — unblock production, dogfood TrustGraph on Verisum, wire the Monday co-work playbook, set up automation flows, and launch outreach.

**Architecture:** Operational setup plan, not a code feature. Tasks span Supabase (migrations via MCP), Hostinger (deploy via MCP), Apollo (contacts/sequences via MCP), Stripe (CLI/curl), Slack (webhooks), Linear (GraphQL API), and Make.com (Chrome-assisted). Each task has a clear "done" state and is independently verifiable.

**Tech Stack:** Supabase MCP, Hostinger MCP, Apollo MCP, Stripe CLI, Slack Incoming Webhooks, Linear GraphQL API, Make.com, Chrome MCP.

**Design doc:** `docs/plans/2026-03-03-agentic-operating-system-design.md`

---

## Phase 1: Unblock Production

### Task 1: Apply Migration 015 to Supabase

Migration 015 (governance_wizard, governance_packs, monthly_reports tables) exists locally but is not applied to production Supabase.

**Step 1: Apply migration via Supabase MCP**

Run: `apply_migration` with project_id `ktwrztposaiyllhadqys`, name `015_governance_wizard_schema`, SQL from `supabase/migrations/015_governance_wizard_schema.sql`

**Step 2: Verify tables exist**

Run: `execute_sql` — `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('governance_wizard', 'governance_packs', 'monthly_reports');`

Expected: 3 rows returned.

**Done when:** All three tables exist in production Supabase with RLS policies active.

---

### Task 2: Merge Starter Self-Serve Branch to Main

Branch `feat/starter-self-serve-redesign` has 15 commits ahead of main including the wizard, governance pack, monthly report, tier restructure, and the agentic OS design doc.

**Step 1: Check for merge conflicts**

Run: `cd ~/trustindex && git fetch origin && git diff main..feat/starter-self-serve-redesign --stat`

**Step 2: Merge to main**

Run: `git checkout main && git merge feat/starter-self-serve-redesign --no-ff -m "Merge feat/starter-self-serve-redesign: wizard, governance pack, monthly reports, tier restructure, agentic OS design"`

**Step 3: Verify build**

Run: `npm run build`

**Step 4: Push to origin**

Run: `git push origin main`

This triggers a Hostinger auto-deploy (git-based, Node 22).

**Step 5: Verify deployment**

Run: `hosting_listJsDeployments` — confirm latest deploy state is `completed`.

**Done when:** Main branch contains all starter redesign work, build passes, deployed to Hostinger.

---

### Task 3: Create Stripe Starter Product and Prices

**Rob must do this in Stripe dashboard. Claude guides.**

**Step 1: Navigate to Stripe Products**

URL: https://dashboard.stripe.com/products

**Step 2: Create product**

- Name: `TrustGraph Starter`
- Description: `AI Governance Copilot for SMEs — wizard, governance pack, declarations, vendor register, incident logging, regulatory feed, monthly reports`

**Step 3: Add monthly price**

- Amount: £79.00
- Currency: GBP
- Billing period: Monthly
- Copy the price ID (starts with `price_...`)

**Step 4: Add yearly price**

- Amount: £790.00
- Currency: GBP
- Billing period: Yearly
- Copy the price ID (starts with `price_...`)

**Step 5: Record price IDs**

Rob provides the two price IDs to Claude for env var setup.

**Done when:** `TrustGraph Starter` product exists in Stripe with both monthly and yearly prices.

---

### Task 4: Set Environment Variables on Hostinger

**Rob imports via hPanel. Claude prepares the .env content.**

**Step 1: Claude prepares complete .env values**

Generate a CRON_SECRET (32-char random string). Compile all env vars Rob needs to add:
- `STRIPE_STARTER_MONTHLY_PRICE_ID` — from Task 3
- `STRIPE_STARTER_YEARLY_PRICE_ID` — from Task 3
- `ANTHROPIC_API_KEY` — Rob provides from console.anthropic.com
- `RESEND_API_KEY` — Rob provides from resend.com/api-keys
- `CRON_SECRET` — Claude generates
- `RESEND_FROM_EMAIL` — `noreply@verisum.org`

**Step 2: Rob imports via hPanel**

hPanel → trustindex.verisum.org → Environment Variables → Import .env file

**Step 3: Verify deploy triggers**

Adding env vars may require a redeploy. Verify via `hosting_listJsDeployments`.

**Done when:** All env vars set on Hostinger, deployment successful with new vars.

---

### Task 5: Fix Make.com Monthly Report CRON_SECRET

The Make.com HTTP module returns 401 when calling `/api/copilot/monthly-report`. Debug and fix.

**Step 1: Verify CRON_SECRET is set on Hostinger**

After Task 4, the CRON_SECRET should be deployed. Test the endpoint directly:

Run: `curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer <CRON_SECRET>" https://trustindex.verisum.org/api/copilot/monthly-report`

If 200: the issue was just the missing env var. Update Make.com with the correct Bearer token value.
If still 401: inspect the response body and debug the auth check.

**Step 2: Update Make.com scenario**

Using Chrome MCP or Rob manually: update the HTTP module's Authorization header to match the deployed CRON_SECRET.

**Step 3: Test Make.com scenario**

Run the scenario manually in Make.com. Verify it completes successfully.

**Done when:** Make.com monthly report scenario runs without auth errors.

---

## Phase 2: Dogfood TrustGraph on Verisum

### Task 6: Register Verisum as Organisation in TrustGraph

**Step 1: Check if Verisum org already exists**

Run via Supabase MCP:
```sql
SELECT id, name FROM organisations WHERE name ILIKE '%verisum%';
```

**Step 2: Create org if not exists**

```sql
INSERT INTO organisations (name, industry, size_band)
VALUES ('Verisum Ltd', 'Technology / AI Governance', '1-10')
RETURNING id;
```

**Step 3: Link Rob's profile to org**

```sql
UPDATE profiles
SET organisation_id = '<org_id>', role = 'admin'
WHERE email = 'rob.fanshawe@verisum.org';
```

**Done when:** Verisum Ltd exists as an organisation with Rob as admin.

---

### Task 7: Run Governance Wizard for Verisum

**Rob does this in the browser — it's the product experience.**

**Step 1: Log into TrustGraph**

URL: https://trustindex.verisum.org/auth/login

**Step 2: Navigate to Setup Wizard**

URL: https://trustindex.verisum.org/setup (or CTA on dashboard)

**Step 3: Complete the 4-step wizard**

- Step 1 — Company Profile: Verisum Ltd, Technology, 1-10, UK
- Step 2 — AI Tool Inventory: Claude Code, Claude API, Apollo.io, Make.com, Resend, GitHub Copilot, Stripe
- Step 3 — Control Posture: Answer honestly (this is the dogfood — real answers)
- Step 4 — Review & Generate

**Step 4: Download Governance Pack**

Three PDFs: Governance Statement, AI Usage Inventory, Risk & Gap Summary.

**Done when:** Verisum has a completed wizard run and downloadable governance pack. This becomes sales collateral.

---

### Task 8: Submit Staff Declaration (Rob)

**Step 1: Create a declaration token**

Via the Copilot dashboard → Declarations section → Create Token.
Label: "Q1 2026 — Verisum Team"

**Step 2: Submit Rob's declaration**

Open the declaration link. Declare:
- Name: Rob Fanshawe
- Department: Engineering / Operations
- AI tools: Claude Code (daily, code + ops), Claude API (product feature), Apollo.io (CRM, business contacts), Make.com (automation), Resend (transactional email)
- Data types per tool: internal code, customer context (anonymised), business contact data

**Done when:** Rob's declaration is visible in the Copilot dashboard.

---

### Task 9: Populate Vendor Register

After wizard completion, vendors should be auto-populated from wizard Step 2. Verify and supplement.

**Step 1: Check auto-populated vendors**

Via Copilot dashboard → Vendor Register.

**Step 2: Add any missing vendors manually**

Ensure all AI tools are registered: Claude (Anthropic), Apollo.io, Make.com, GitHub Copilot (Microsoft), Stripe (AI fraud detection).

**Step 3: Set risk categories**

Review each vendor's data classification and set risk category (minimal/limited/high per EU AI Act).

**Done when:** Verisum's vendor register is complete with risk categories assigned.

---

## Phase 3: Monday Playbook Infrastructure

### Task 10: Set Up Slack Channels and Webhooks

**Step 1: Create Slack channels**

Rob creates (or Claude via Chrome): `#revenue`, `#marketing`, `#product`

**Step 2: Create incoming webhooks**

Slack → Apps → Incoming Webhooks → Add to each channel.
Record webhook URLs for each channel.

**Step 3: Store webhook URLs**

Add to `.env.local` (and `.env.example` as placeholders):
```
SLACK_WEBHOOK_REVENUE=https://hooks.slack.com/services/...
SLACK_WEBHOOK_MARKETING=https://hooks.slack.com/services/...
SLACK_WEBHOOK_PRODUCT=https://hooks.slack.com/services/...
```

**Step 4: Test each webhook**

Run via bash:
```bash
curl -X POST -H 'Content-type: application/json' --data '{"text":"Test from Claude Code"}' $SLACK_WEBHOOK_REVENUE
```

**Done when:** Three Slack channels exist with working incoming webhooks.

---

### Task 11: Create Monday Pulse Script

A shell script (or Node script) that Claude runs at the start of each Monday session to pull all metrics.

**Files:**
- Create: `scripts/monday-pulse.ts`

**Step 1: Create the metrics aggregation script**

A TypeScript script that:
1. Queries Stripe API for MRR, new subscribers, churn (via `stripe` CLI or curl)
2. Queries Supabase for signups, active users, wizard completions, pack generations
3. Queries Apollo for pipeline status (via MCP — summarise manually)
4. Formats as a "Weekly Pulse" Slack message
5. Posts to Slack `#revenue` channel

**Step 2: Test locally**

Run: `npx tsx scripts/monday-pulse.ts`

Expected: Slack message posted with current metrics.

**Step 3: Commit**

```bash
git add scripts/monday-pulse.ts
git commit -m "feat: monday pulse metrics script for co-work sessions"
```

**Done when:** Script runs and posts formatted metrics to Slack.

---

### Task 12: Set Up Linear API Access

**Step 1: Generate Linear API key**

Rob generates at: https://linear.app/verisum/settings/api

**Step 2: Store API key**

Add to `.env.local`:
```
LINEAR_API_KEY=lin_api_...
```

**Step 3: Test Linear query**

Run via bash:
```bash
curl -s -H "Authorization: Bearer $LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ issues(filter: { state: { name: { in: [\"In Progress\", \"Todo\"] } } }) { nodes { title state { name } priority } } }"}' \
  https://api.linear.app/graphql | jq '.data.issues.nodes[:5]'
```

**Done when:** Linear API key works and can query issues.

---

## Phase 4: Automation Flows

### Task 13: Extend Make.com Stripe → Slack Scenario

Existing scenario handles `checkout.session.completed`. Extend to cover more events.

**Step 1: Add triggers (Chrome-assisted or Rob manually)**

Add Stripe webhook triggers for:
- `invoice.payment_succeeded` → Slack #revenue: "💰 Payment received: £X from [customer]"
- `invoice.payment_failed` → Slack #revenue: "⚠️ Payment failed: [customer]"
- `customer.subscription.deleted` → Slack #revenue: "📉 Churn: [customer] cancelled"

**Step 2: Test each trigger**

Use Stripe test mode to trigger each event. Verify Slack messages appear.

**Done when:** Revenue events post to Slack #revenue automatically.

---

### Task 14: Make.com New Signup → Slack + Notion

**Step 1: Create Make.com scenario**

Trigger: Supabase webhook on `profiles` INSERT (or custom webhook from the app)
Actions:
1. Post to Slack #product: "👤 New signup: [email] ([plan])"
2. Create Notion CRM row (if Notion API connected): Name, Email, Plan, Signup Date

Alternative: If Notion API is too complex, just post to Slack and Rob manually adds to Notion during Monday session.

**Step 2: Test with a test signup**

Create a test profile in Supabase. Verify Slack message appears.

**Done when:** New signups trigger Slack notifications.

---

### Task 15: Weekly Digest — Monday Session or Automated

**Decision:** Given that the Monday co-work session pulls metrics live via the pulse script (Task 11), a separate Make.com weekly digest is redundant initially.

**Implementation:** The monday-pulse.ts script IS the weekly digest. It runs at the start of each Monday session and posts to Slack.

**Future enhancement:** If Rob wants the digest to arrive before the session starts (e.g., 7am), move the script to a Make.com scheduled scenario or a Supabase Edge Function on a cron.

**Done when:** Monday pulse script works (covered by Task 11).

---

## Phase 5: Launch Outreach

### Task 16: Define ICP and Build Apollo Prospect List

**Step 1: Define ICP filters in Apollo**

Using Apollo MCP, search for prospects matching:
- Company size: 10-200 employees
- Industries: digital agency, marketing, recruitment, accounting, consulting, tech startup
- Location: UK and EU
- Technology signals: using AI tools (ChatGPT, Copilot, etc.)
- No existing AI governance solution

**Step 2: Run search and review results**

Run: `apollo_mixed_people_api_search` with ICP filters. Target: decision-makers (C-suite, VP, Director, Head of) in operations, technology, compliance, or risk roles.

**Step 3: Enrich top 20 prospects**

Run: `apollo_people_bulk_match` for top prospects to get email addresses and details.

**Step 4: Present to Rob for review**

Show prospect list with company, role, LinkedIn, and AI signals. Rob selects which to pursue.

**Done when:** First batch of 20+ qualified prospects identified and enriched.

---

### Task 17: Create Outreach Sequence in Apollo

**Step 1: Draft outreach templates**

Claude drafts 3-step email sequence:
1. **Day 1 — Introduction:** Personalised to their industry + AI usage. Mention governance gap. Offer free Explorer assessment.
2. **Day 4 — Value add:** Share a relevant insight (e.g., EU AI Act deadline, ICO guidance). Link to Verisum blog/LinkedIn post.
3. **Day 8 — Soft CTA:** "Most [industry] firms we talk to have no AI policy. Our Starter plan gets you covered in 30 minutes. Here's what the governance pack looks like [link to Verisum's own pack]."

**Step 2: Create sequence in Apollo**

Run: `apollo_emailer_campaigns_search` to check existing sequences.
If none suitable: Rob creates in Apollo dashboard (or Chrome-assisted).

**Step 3: Add first batch of contacts**

Run: `apollo_emailer_campaigns_add_contact_ids` — add approved contacts from Task 16.

Rob reviews and approves before sending.

**Done when:** Apollo sequence created with templates, first contacts queued for Rob's approval.

---

### Task 18: Draft First LinkedIn Posts

**Step 1: Claude drafts 2-3 posts**

Topics:
1. "We just built our own AI governance pack using TrustGraph. Here's what it looks like." (dogfooding story + screenshot)
2. AI governance insight relevant to target segments (EU AI Act, ICO guidance, common gaps)
3. Product announcement: "TrustGraph Starter — AI compliance sorted in 30 minutes"

**Step 2: Rob edits for voice**

Claude presents drafts. Rob refines tone, adds personal angle, approves.

**Step 3: Schedule or publish**

Rob posts manually (or Chrome-assisted scheduling).

**Done when:** 2-3 LinkedIn posts drafted, edited, and ready to publish.

---

## Execution Order Summary

| Phase | Tasks | Focus | Claude Executes | Rob Approves |
|-------|-------|-------|----------------|-------------|
| 1 | 1-5 | Unblock production | Migration, merge, deploy | Stripe products, env vars, Make.com |
| 2 | 6-9 | Dogfood TrustGraph | DB setup, org creation | Wizard completion, declaration |
| 3 | 10-12 | Monday playbook infra | Pulse script, API setup | Slack channels, API keys |
| 4 | 13-15 | Automation flows | Script wiring | Make.com scenarios |
| 5 | 16-18 | Launch outreach | Prospect search, drafting | Approval of contacts + content |

**Estimated total: 2-3 sessions** (mix of Claude execution and Rob sign-off tasks)
